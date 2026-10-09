/**
 * Placement de l'axe des motifs (docs/parquet/SPEC.md §4.3.3) : trois propositions, chacune avec la plus
 * petite largeur de coupe en bord qu'elle donne (découpage seul, sans réemploi : rapide). Pur.
 */
import { intersection } from '../../../core/geometry/boolean';
import { signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';
import { patternCells } from './patterned';
import { insideRegion } from './rings';
import type { AxisOption, LayoutSpec, PlacedLayout } from './types';

/** Plus petite largeur de coupe en bord : aire / plus grande longueur, sur les pièces coupées. */
export function minEdgeWidth(l: PlacedLayout, layable: Polygon[]): number {
  let min = Infinity;
  for (const c of patternCells(l, layable)) {
    // cellule entière : pas de coupe en bord
    if (insideRegion(c.p, layable)) continue;
    const cellArea = Math.abs(signedArea(c.p));
    for (const r of intersection([c.p], layable)) {
      const a = Math.abs(signedArea(r));
      if (a < 1 || a >= cellArea * 0.999) continue;
      let len = 0;
      for (const p of r) for (const q of r) len = Math.max(len, Math.hypot(p[0] - q[0], p[1] - q[1]));
      min = Math.min(min, a / Math.max(len, 1e-6));
    }
  }
  return Number.isFinite(min) ? Math.round(min) : 0;
}

export function axisOptions(l: LayoutSpec, layable: Polygon[]): AxisOption[] {
  const board = l.board!;
  const first = l.rooms[0]!;
  const xs = first.outline.map((p) => p[0]),
    ys = first.outline.map((p) => p[1]);
  const options: { kind: AxisOption['kind']; point: Point }[] = [
    { kind: 'room-center', point: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] },
  ];
  // porte principale : la plus large des portes et baies des pièces de la pose
  const doors = l.rooms.flatMap((r) => r.openings.filter((o) => o.kind !== 'window'));
  const main = doors.sort((a, b) => len(b.segment) - len(a.segment))[0];
  if (main)
    options.push({
      kind: 'main-door',
      point: [(main.segment[0][0] + main.segment[1][0]) / 2, (main.segment[0][1] + main.segment[1][1]) / 2],
    });
  // aligné sur le mur de référence : limite de bande au bord posable, première bande entière
  const u: Point = l.referenceDirection;
  const n: Point = [-u[1], u[0]];
  // bord posable le long du mur de référence : point le plus « bas » de la surface selon n
  const pts = layable.flat();
  const edge = Math.min(...pts.map((p) => p[0] * n[0] + p[1] * n[1]));
  const along =
    (Math.min(...pts.map((p) => p[0] * u[0] + p[1] * u[1])) + Math.max(...pts.map((p) => p[0] * u[0] + p[1] * u[1]))) /
    2;
  const L = board.lengths[0]!,
    W = board.width;
  // demi-largeur de bande de part et d'autre de l'axe : bâton rompu (L + W)/(2√2) ; Hongrie : l'axe est une limite
  const half = l.pattern.kind === 'herringbone' ? (L + W) / (2 * Math.SQRT2) : 0;
  const d = edge + half;
  options.push({ kind: 'reference-wall', point: [u[0] * along + n[0] * d, u[1] * along + n[1] * d] });
  return options.map((o) => ({
    ...o,
    point: [Math.round(o.point[0] * 100) / 100, Math.round(o.point[1] * 100) / 100],
    minCutWidth: minEdgeWidth({ ...l, axis: o.point, offset: [0, 0] }, layable),
  }));
}

const len = (s: [Point, Point]) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
