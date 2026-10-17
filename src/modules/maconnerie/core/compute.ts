/**
 * Moteur de la maçonnerie (docs/materiaux/SPEC.md) : rangs, éléments, coupes, liant et poids d'un mur ; panneau
 * d'éléments entiers pour les briques de verre. Pur et déterministe. Valeurs indicatives (estimation).
 */
import type {
  GlassLayout,
  MaconnerieResult,
  MaconnerieSpec,
  MasonryAlert,
  MaterialTotal,
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

/** Éléments d'un rang de longueur `L`, décalé de `offset` (le premier élément dépasse du bord). */
export const rowPieces = (L: number, l: number, j: number, offset: number): number =>
  Math.max(1, Math.ceil((L + offset + j) / (l + j) - EPS));

const isMultiple = (x: number, p: number) => Math.abs(x / p - Math.round(x / p)) < 1e-6;

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

export function computeWall(w: WallSpec): WallResult {
  const m = w.material;
  const t = m.laying;
  const alerts: MasonryAlert[] = [];
  const area = (w.length * w.height) / 1e6;
  if (w.joint < t.jointH.min - EPS || w.joint > t.jointH.max + EPS)
    alerts.push({
      code: 'joint-out-of-range',
      wall: w.id,
      params: { joint: w.joint, min: t.jointH.min, max: t.jointH.max },
    });

  let courses: number;
  let elements: number;
  let cut = 0;
  let glass: GlassLayout | null = null;

  if (!t.cutAllowed) {
    glass = glassLayout(w.length, w.height, m.length, m.height, w.joint);
    if (!glass) {
      alerts.push({ code: 'too-small', wall: w.id, params: { length: m.length, height: m.height } });
      return {
        id: w.id,
        ok: false,
        courses: 0,
        elements: 0,
        cut: 0,
        area,
        binderKg: null,
        weightKg: null,
        glass,
        alerts,
      };
    }
    courses = glass.rows;
    elements = glass.cols * glass.rows;
    if (glass.borderX > GLASS_BORDER.max + EPS || glass.borderY > GLASS_BORDER.max + EPS)
      alerts.push({
        code: 'glass-not-cuttable',
        wall: w.id,
        params: {
          cols: glass.cols,
          rows: glass.rows,
          width: glass.cols * m.length + (glass.cols - 1) * w.joint + 2 * GLASS_BORDER.min,
          height: glass.rows * m.height + (glass.rows - 1) * w.joint + 2 * GLASS_BORDER.min,
        },
      });
    const max = glassMaxArea(m.thickness);
    if (area > max + EPS) alerts.push({ code: 'panel-area-exceeds-max', wall: w.id, params: { area, max } });
  } else {
    const jv = t.jointV ? w.joint : 0;
    const pitch = m.length + jv;
    const offsetOf = (c: number) => (t.bond === 'running' && c % 2 === 1 ? pitch / 2 : 0);
    courses = courseCount(w.height, m.height, w.joint);
    elements = 0;
    for (let c = 0; c < courses; c++) {
      const offset = offsetOf(c);
      elements += rowPieces(w.length, m.length, jv, offset);
      cut += (offset > 0 ? 1 : 0) + (isMultiple(w.length + offset + jv, pitch) ? 0 : 1);
    }
    // dernier rang recoupé en hauteur : tous ses éléments
    if (!isMultiple(w.height + w.joint, m.height + w.joint))
      cut += rowPieces(w.length, m.length, jv, offsetOf(courses - 1));
    cut = Math.min(cut, elements);
  }

  if (t.binderPerM2 == null) alerts.push({ code: 'binder-unknown', wall: w.id });
  return {
    id: w.id,
    ok: true,
    courses,
    elements,
    cut,
    area,
    binderKg: t.binderPerM2 == null ? null : area * t.binderPerM2,
    weightKg: m.weight == null ? null : elements * m.weight,
    glass,
    alerts,
  };
}

/** Totaux par matériau, dans l'ordre d'apparition des murs. */
export function computeMaconnerie(spec: MaconnerieSpec): MaconnerieResult {
  const walls = spec.walls.map(computeWall);
  const totals = new Map<string, MaterialTotal>();
  spec.walls.forEach((w, i) => {
    const r = walls[i]!;
    if (!r.ok) return;
    const m = w.material;
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
  });
  for (const t of totals.values()) t.purchased = Math.ceil(t.elements * (1 + spec.margin) - EPS);
  return { walls, totals: [...totals.values()], alerts: walls.flatMap((w) => w.alerts) };
}
