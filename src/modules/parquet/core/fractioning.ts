/**
 * Plusieurs pièces et fractionnement (docs/parquet/SPEC.md §4.1, §4.4) : bandes des passages, coupe le long
 * des seuils, zones des poses séparées, seuils proposés et alertes. Pur, repère du plan, mm.
 */
import { pointInPolygon, signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon, Segment } from '../../../core/geometry/types';
import { alertsApply } from './defaults';
import type { Frame } from './frame';
import type { LayoutSpec, ParquetWarning, PassageSpec, Threshold, ZoneBound } from './types';

/** Assez grand pour couvrir tout plan réaliste (1 km). */
const FAR = 1e6;

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k];
const unit = (v: Point): Point => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const round = (p: Point): Point => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

/** Contour dans le sens attendu (aire signée > 0). */
const oriented = (p: Polygon): Polygon => (signedArea(p) < 0 ? [...p].reverse() : p);

/** Rectangle autour d'un segment : de `from` à `to` le long, de `a` à `b` en travers (normale n). */
function band(p0: Point, d: Point, n: Point, from: number, to: number, a: number, b: number): Polygon {
  return oriented([
    add(add(p0, d, from), n, a),
    add(add(p0, d, to), n, a),
    add(add(p0, d, to), n, b),
    add(add(p0, d, from), n, b),
  ]);
}

/** Repère d'un passage : d le long de l'ouverture, n du côté de la pièce `a` vers la pièce `b`. */
function passageFrame(p: PassageSpec, roomA: Polygon | undefined) {
  const [p0, p1] = p.segment;
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const d = unit(sub(p1, p0));
  let n: Point = [-d[1], d[0]];
  const mid = add(p0, d, len / 2);
  if (roomA && pointInPolygon(add(mid, n, 1), roomA)) n = [-n[0], -n[1]];
  return { p0, d, n, len };
}

/** Bande du passage, jeu aux montants, prolongée du jeu dans chaque pièce pour rejoindre leurs surfaces. */
export function passageBand(p: PassageSpec, roomA: Polygon | undefined, gap: number): Polygon {
  const f = passageFrame(p, roomA);
  return band(f.p0, f.d, f.n, gap, f.len - gap, -gap - 0.5, p.depth + gap + 0.5);
}

/** Seuil d'un passage : au milieu du mur, d'un montant à l'autre. */
export function passageThreshold(p: PassageSpec, roomA: Polygon | undefined): Segment {
  const f = passageFrame(p, roomA);
  const a = add(f.p0, f.n, p.depth / 2);
  return [round(a), round(add(a, f.d, f.len))];
}

/** Bande retirée le long d'un seuil : un jeu de chaque côté, prolongée d'un jeu aux deux bouts. */
export function breakBand(s: Segment, gap: number): Polygon {
  const len = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
  const d = unit(sub(s[1], s[0]));
  return band(s[0], d, [-d[1], d[0]], -gap - 1, len + gap + 1, -gap, gap);
}

/** Demi-plan d'une zone, en retrait d'un jeu sur la ligne. */
export function halfPlane(b: ZoneBound, gap: number): Polygon {
  const d = unit(sub(b.line[1], b.line[0]));
  const n: Point = [-d[1] * b.side, d[0] * b.side];
  return band(b.line[0], d, n, -FAR, FAR, gap, FAR);
}

/** Partie de la droite (p, d) dans la surface : du premier au dernier croisement d'un bord. null : hors surface. */
export function clipLine(p: Point, d: Point, rings: Polygon[]): Segment | null {
  let lo = Infinity,
    hi = -Infinity;
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i]!,
        b = r[(i + 1) % r.length]!;
      const e = sub(b, a);
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-12) continue;
      const w = sub(a, p);
      const t = (w[0] * e[1] - w[1] * e[0]) / den;
      const u = (w[0] * d[1] - w[1] * d[0]) / den;
      if (u < -1e-9 || u > 1 + 1e-9) continue;
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
  return hi - lo > 1 ? [round(add(p, d, lo)), round(add(p, d, hi))] : null;
}

/**
 * Seuil tracé à la main : prolongé jusqu'aux bords de la surface qu'il traverse (la corde qui contient son
 * milieu), s'il s'arrête avant. Un seuil qui atteint déjà les bords (seuil de porte) est gardé tel quel.
 */
export function extendBreak(s: Segment, rings: Polygon[]): Segment {
  const len = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
  if (len < 1) return s;
  const d = unit(sub(s[1], s[0]));
  const mid: Point = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
  const ts: number[] = [];
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i]!,
        b = r[(i + 1) % r.length]!;
      const e = sub(b, a);
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-12) continue;
      const w = sub(a, mid);
      const t = (w[0] * e[1] - w[1] * e[0]) / den;
      const u = (w[0] * d[1] - w[1] * d[0]) / den;
      if (u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
    }
  const lo = Math.max(-Infinity, ...ts.filter((t) => t < 0)),
    hi = Math.min(Infinity, ...ts.filter((t) => t > 0));
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return s;
  const from = Math.min(-len / 2, lo),
    to = Math.max(len / 2, hi);
  if (from === -len / 2 && to === len / 2) return s;
  return [round(add(mid, d, from)), round(add(mid, d, to))];
}

/** Morceaux d'un seul tenant : contours extérieurs (aire > 0) avec leurs trous. */
export function components(rings: Polygon[]): Polygon[][] {
  const outers = rings.filter((r) => signedArea(r) > 0);
  const out = outers.map((o) => [o]);
  for (const h of rings.filter((r) => signedArea(r) <= 0)) {
    const i = outers.findIndex((o) => pointInPolygon(h[0]!, o));
    if (i >= 0) out[i]!.push(h);
  }
  return out;
}

const inside = (p: Point, comp: Polygon[]) =>
  pointInPolygon(p, comp[0]!) && !comp.slice(1).some((h) => pointInPolygon(p, h));

/** Seuils posés (breaks, limites de zone côté 1) : rattachés au passage qu'ils coupent. */
export function appliedThresholds(l: LayoutSpec, base: Polygon[]): Threshold[] {
  const roomOf = (id: string) => l.rooms.find((r) => r.id === id)?.outline;
  const passageAt = (s: Segment) => {
    const mid: Point = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
    return l.passages.find((p) => pointInPolygon(mid, passageBand(p, roomOf(p.a), 0))) ?? null;
  };
  const out: Threshold[] = l.breaks.map((b, i) => {
    const s = extendBreak(b, base);
    return { segment: s, passage: passageAt(s)?.id ?? null, status: 'applied', breakIndex: i };
  });
  for (const b of l.zone) {
    if (b.side !== 1) continue;
    const seg = clipLine(b.line[0], unit(sub(b.line[1], b.line[0])), base);
    if (seg) out.push({ segment: seg, passage: passageAt(seg)?.id ?? null, status: 'applied' });
  }
  return out;
}

/**
 * Alertes de passage et de fractionnement (pose flottante seulement), avec un seuil proposé pour chacune :
 * passage étroit → au milieu du mur ; morceau trop grand → au passage le plus étroit du morceau, sinon au milieu
 * de la dimension trop grande.
 */
export function fractioning(
  l: LayoutSpec,
  layable: Polygon[],
  frame: Frame,
): { warnings: ParquetWarning[]; thresholds: Threshold[] } {
  const warnings: ParquetWarning[] = [];
  const thresholds: Threshold[] = [];
  if (!alertsApply(l.method)) return { warnings, thresholds };
  const roomOf = (id: string) => l.rooms.find((r) => r.id === id)?.outline;
  const comps = components(layable);
  // passage ouvert : le milieu de sa bande est posable (sinon un seuil le coupe)
  const open = l.passages
    .map((p) => {
      const s = passageThreshold(p, roomOf(p.a));
      const mid: Point = [(s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2];
      return { p, s, comp: comps.findIndex((c) => inside(mid, c)) };
    })
    .filter((x) => x.comp >= 0);

  const { minPassageWidth, maxFloatingLength, maxFloatingWidth } = l.rules;
  const proposed = new Set<string>();
  if (minPassageWidth != null)
    for (const { p, s } of open)
      if (p.width < minPassageWidth) {
        warnings.push({ code: 'narrow-passage', passage: p.id, width: p.width });
        thresholds.push({ segment: s, passage: p.id, status: 'proposed', reason: 'narrow-passage' });
        proposed.add(p.id);
      }

  comps.forEach((c, i) => {
    const us = c[0]!.map((q) => q[0] * frame.u[0] + q[1] * frame.u[1]);
    const vs = c[0]!.map((q) => q[0] * frame.v[0] + q[1] * frame.v[1]);
    const length = Math.max(...us) - Math.min(...us),
      width = Math.max(...vs) - Math.min(...vs);
    const longOver = maxFloatingLength != null && length > maxFloatingLength + 1e-6;
    const wideOver = maxFloatingWidth != null && width > maxFloatingWidth + 1e-6;
    if (!longOver && !wideOver) return;
    warnings.push({ code: 'fractioning-needed', length: Math.round(length), width: Math.round(width) });
    const door = open.filter((x) => x.comp === i).sort((a, b) => a.p.width - b.p.width)[0];
    if (door) {
      if (!proposed.has(door.p.id))
        thresholds.push({ segment: door.s, passage: door.p.id, status: 'proposed', reason: 'fractioning' });
      return;
    }
    // milieu de la dimension trop grande, en travers de celle-ci
    const along = longOver ? frame.u : frame.v;
    const across = longOver ? frame.v : frame.u;
    const ts = longOver ? us : vs;
    const tm = (Math.min(...ts) + Math.max(...ts)) / 2;
    const other = longOver ? vs : us;
    const om = (Math.min(...other) + Math.max(...other)) / 2;
    const p: Point = [along[0] * tm + across[0] * om, along[1] * tm + across[1] * om];
    const seg = clipLine(p, across, c);
    if (seg) thresholds.push({ segment: seg, passage: null, status: 'proposed', reason: 'fractioning' });
  });
  return { warnings, thresholds };
}
