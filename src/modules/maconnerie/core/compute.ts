/**
 * Moteur de la maçonnerie (docs/materiaux/SPEC.md) : un mur est un matériau de base monté rang par rang autour de ses
 * ouvertures et de ses zones, chaque zone étant elle-même montée dans son matériau ; les briques de verre se posent
 * en éléments entiers avec une bordure. Pur et déterministe. Valeurs indicatives (estimation).
 */
import type {
  GlassLayout,
  MaconnerieResult,
  MaconnerieSpec,
  MasonryAlert,
  Material,
  MaterialTotal,
  Rect,
  SurfaceResult,
  WallResult,
  WallSpec,
} from './types';

const EPS = 1e-9;
/** Bordure périphérique d'un panneau de briques de verre (mm, fiche La Roche, à confirmer). */
export const GLASS_BORDER = { min: 40, max: 100 };

/** Surface maximale d'un panneau de briques de verre selon l'épaisseur (m², estimation à recouper). */
export const glassMaxArea = (thickness: number): number => (thickness <= 60 ? 3 : thickness <= 90 ? 30 : 40);

/** Nombre de rangs de hauteur `h` (joint `j`) pour couvrir `H`. */
export const courseCount = (H: number, h: number, j: number): number => Math.max(1, Math.ceil((H + j) / (h + j) - EPS));

type Interval = [number, number];

/** [0, L] moins les intervalles bloqués (rognés, fusionnés), dans l'ordre. */
export function freeSegments(L: number, blocked: Interval[]): Interval[] {
  const bs = blocked
    .map(([a, b]): Interval => [Math.max(0, a), Math.min(L, b)])
    .filter(([a, b]) => b - a > EPS)
    .sort((p, q) => p[0] - q[0]);
  const out: Interval[] = [];
  let x = 0;
  for (const [a, b] of bs) {
    if (a > x + EPS) out.push([x, a]);
    x = Math.max(x, b);
  }
  if (L > x + EPS) out.push([x, L]);
  return out;
}

/**
 * Éléments d'un rang qui touchent [s, e] : longueur `l`, pas `pitch` (élément + joint), grille décalée de `offset`
 * (l'élément k commence en k × pitch − offset). Coupés : ceux qui dépassent d'un bout.
 */
export function segmentPieces(s: number, e: number, l: number, pitch: number, offset: number) {
  const kMax = Math.ceil((e + offset) / pitch - EPS) - 1;
  const kMin = Math.floor((s + offset - l) / pitch + EPS) + 1;
  const pieces = Math.max(0, kMax - kMin + 1);
  if (!pieces) return { pieces: 0, cut: 0 };
  const first = kMin * pitch - offset < s - EPS;
  const last = kMax * pitch - offset + l > e + EPS;
  return { pieces, cut: pieces === 1 ? (first || last ? 1 : 0) : (first ? 1 : 0) + (last ? 1 : 0) };
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS;

/** Aire de `r` dans le rectangle [0, L] × [0, H] (mm²). */
const clippedArea = (r: Rect, L: number, H: number) =>
  Math.max(0, Math.min(L, r.x + r.width) - Math.max(0, r.x)) *
  Math.max(0, Math.min(H, r.y + r.height) - Math.max(0, r.y));

/** Panneau d'éléments entiers : le plus grand nombre de colonnes et de rangs qui laisse la bordure mini. */
export function glassLayout(L: number, H: number, l: number, h: number, j: number): GlassLayout | null {
  const cols = Math.floor((L - 2 * GLASS_BORDER.min + j) / (l + j) + EPS);
  const rows = Math.floor((H - 2 * GLASS_BORDER.min + j) / (h + j) + EPS);
  if (cols < 1 || rows < 1) return null;
  const borderX = (L - (cols * l + (cols - 1) * j)) / 2;
  const borderY = (H - (rows * h + (rows - 1) * j)) / 2;
  // un fer par joint et un dans chaque bordure, dans les deux sens
  const reinforcement = (rows + 1) * L + (cols + 1) * H;
  return { cols, rows, borderX, borderY, reinforcement };
}

/** Rangs, éléments et coupes d'un matériau qui se coupe, sur L × H moins `holes`. */
function laid(L: number, H: number, m: Material, j: number, holes: Rect[]) {
  const t = m.laying;
  const jv = t.jointV ? j : 0;
  const pitch = m.length + jv;
  const courses = courseCount(H, m.height, j);
  let elements = 0;
  let cut = 0;
  for (let c = 0; c < courses; c++) {
    const y0 = c * (m.height + j);
    const y1 = Math.min(y0 + m.height, H);
    if (y1 <= y0 + EPS) continue;
    const offset = t.bond === 'running' && c % 2 === 1 ? pitch / 2 : 0;
    const over = holes.filter((o) => o.y < y1 - EPS && o.y + o.height > y0 + EPS);
    // un trou sur toute la hauteur du rang l'interrompt ; sur une partie, les éléments au droit sont recoupés
    const full = over.filter((o) => o.y <= y0 + EPS && o.y + o.height >= y1 - EPS);
    const partial = over.filter((o) => !full.includes(o));
    const lowered = y1 - y0 < m.height - EPS;
    for (const [s, e] of freeSegments(
      L,
      full.map((o): Interval => [o.x, o.x + o.width]),
    )) {
      const r = segmentPieces(s, e, m.length, pitch, offset);
      elements += r.pieces;
      cut += lowered ? r.pieces : r.cut;
    }
    if (!lowered)
      for (const o of partial)
        cut += segmentPieces(Math.max(0, o.x), Math.min(L, o.x + o.width), m.length, pitch, offset).pieces;
  }
  return { courses, elements, cut: Math.min(cut, elements) };
}

/** Quantités d'une surface d'un seul matériau ; les alertes passent par `alert`. */
function surface(
  L: number,
  H: number,
  m: Material,
  j: number,
  holes: Rect[],
  alert: (code: MasonryAlert['code'], params?: Record<string, number>) => void,
): SurfaceResult {
  const t = m.laying;
  const area = (L * H - holes.reduce((s, o) => s + clippedArea(o, L, H), 0)) / 1e6;
  if (j < t.jointH.min - EPS || j > t.jointH.max + EPS)
    alert('joint-out-of-range', { joint: j, min: t.jointH.min, max: t.jointH.max });
  const none = { material: m.id, courses: 0, elements: 0, cut: 0, area, binderKg: null, weightKg: null, glass: null };

  let courses: number;
  let elements: number;
  let cut = 0;
  let glass: GlassLayout | null = null;
  if (!t.cutAllowed) {
    glass = glassLayout(L, H, m.length, m.height, j);
    if (!glass) {
      alert('too-small', { length: m.length, height: m.height });
      return { ...none, ok: false };
    }
    courses = glass.rows;
    elements = 0;
    for (let r = 0; r < glass.rows; r++)
      for (let c = 0; c < glass.cols; c++) {
        const cell = {
          x: glass.borderX + c * (m.length + j),
          y: glass.borderY + r * (m.height + j),
          width: m.length,
          height: m.height,
        };
        if (!holes.some((o) => overlaps(o, cell))) elements++;
      }
    if (glass.borderX > GLASS_BORDER.max + EPS || glass.borderY > GLASS_BORDER.max + EPS)
      alert('glass-not-cuttable', {
        cols: glass.cols,
        rows: glass.rows,
        width: glass.cols * m.length + (glass.cols - 1) * j + 2 * GLASS_BORDER.min,
        height: glass.rows * m.height + (glass.rows - 1) * j + 2 * GLASS_BORDER.min,
      });
    const max = glassMaxArea(m.thickness);
    if (area > max + EPS) alert('panel-area-exceeds-max', { area, max });
  } else {
    ({ courses, elements, cut } = laid(L, H, m, j, holes));
  }

  if (t.binderPerM2 == null) alert('binder-unknown');
  return {
    material: m.id,
    ok: true,
    courses,
    elements,
    cut,
    area,
    binderKg: t.binderPerM2 == null ? null : area * t.binderPerM2,
    weightKg: m.weight == null ? null : elements * m.weight,
    glass,
  };
}

export function computeWall(w: WallSpec): WallResult {
  const alerts: MasonryAlert[] = [];
  const push = (zone?: string) => (code: MasonryAlert['code'], params?: Record<string, number>) =>
    alerts.push({ code, wall: w.id, ...(zone ? { zone } : {}), ...(params ? { params } : {}) });

  w.zones.forEach((z, i) => {
    if (z.x < -EPS || z.y < -EPS || z.x + z.width > w.length + EPS || z.y + z.height > w.height + EPS)
      push(z.id)('zone-outside');
    if (w.zones.slice(0, i).some((o) => overlaps(o, z))) push(z.id)('zone-overlap');
    if (w.holes.some((o) => overlaps(o, z))) push(z.id)('zone-on-opening');
  });
  const base = surface(w.length, w.height, w.material, w.joint, [...w.zones, ...w.holes], push());
  const zones = w.zones.map((z) => ({
    id: z.id,
    ...surface(
      z.width,
      z.height,
      z.material,
      z.joint,
      w.holes.map((o) => ({ ...o, x: o.x - z.x, y: o.y - z.y })),
      push(z.id),
    ),
  }));
  return { id: w.id, ...base, zones, alerts };
}

/** Totaux par matériau (base et zones), dans l'ordre d'apparition. */
export function computeMaconnerie(spec: MaconnerieSpec): MaconnerieResult {
  const walls = spec.walls.map(computeWall);
  const totals = new Map<string, MaterialTotal>();
  const add = (m: Material, r: SurfaceResult) => {
    if (!r.ok) return;
    const cur = totals.get(m.id) ?? {
      material: m.id,
      name: m.name,
      elements: 0,
      purchased: 0,
      binder: m.laying.binder,
      binderKg: 0,
      weightKg: 0,
      reinforcement: 0,
    };
    cur.elements += r.elements;
    cur.binderKg = cur.binderKg == null || r.binderKg == null ? null : cur.binderKg + r.binderKg;
    cur.weightKg = cur.weightKg == null || r.weightKg == null ? null : cur.weightKg + r.weightKg;
    cur.reinforcement += r.glass?.reinforcement ?? 0;
    totals.set(m.id, cur);
  };
  spec.walls.forEach((w, i) => {
    const r = walls[i]!;
    add(w.material, r);
    w.zones.forEach((z, k) => add(z.material, r.zones[k]!));
  });
  for (const t of totals.values()) t.purchased = Math.ceil(t.elements * (1 + spec.margin) - EPS);
  return { walls, totals: [...totals.values()], alerts: walls.flatMap((w) => w.alerts) };
}
