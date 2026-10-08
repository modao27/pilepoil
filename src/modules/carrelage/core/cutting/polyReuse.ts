import { EPS } from '../../../../core/constants';
import { area, bbox, centroid, clipHalf, insideConvex } from '../../../../core/geometry/polygon';
import type { CutTile, Orientation, Piece, Point, Polygon, TileShape } from '../types';
import type { CutContext, PolyStock } from './stock';

/** Rotations de symétrie de la forme permises par le sens du carreau [symAngles]. */
export function symmetryAngles(shape: TileShape, o: Orientation): number[] {
  const all =
    shape === 'hex'
      ? [0, 1, 2, 3, 4, 5].map((k) => (k * Math.PI) / 3)
      : shape === 'octo'
        ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * Math.PI) / 4)
        : [0, Math.PI];
  if (o === 'none') return [0];
  if (o === '180') return all.filter((a) => a === 0 || Math.abs(a - Math.PI) < 1e-6);
  return all;
}

/**
 * Chute d'une pièce P taillée d'une seule coupe droite dans le carreau T (repère centré), moins le kerf.
 * null si plusieurs coupes ou chute trop petite [polyComplement].
 */
export function polyComplement(P: Polygon, T: Polygon, ctx: CutContext): Polygon | null {
  const onT = (A: Point, B: Point) =>
    T.some((C, i) => {
      const D = T[(i + 1) % T.length]!,
        dx = D[0] - C[0],
        dy = D[1] - C[1],
        l = Math.hypot(dx, dy);
      return (
        Math.abs(dx * (A[1] - C[1]) - dy * (A[0] - C[0])) / l < EPS &&
        Math.abs(dx * (B[1] - C[1]) - dy * (B[0] - C[0])) / l < EPS
      );
    });
  const ie: [Point, Point][] = [];
  for (let i = 0; i < P.length; i++) {
    const A = P[i]!,
      B = P[(i + 1) % P.length]!;
    if (Math.hypot(B[0] - A[0], B[1] - A[1]) > EPS && !onT(A, B)) ie.push([A, B]);
  }
  if (ie.length !== 1) return null;
  const [A, B] = ie[0]!,
    dx = B[0] - A[0],
    dy = B[1] - A[1],
    l = Math.hypot(dx, dy);
  const C = centroid(P);
  const sg = Math.sign(dx * (C[1] - A[1]) - dy * (C[0] - A[0])) || 1;
  const out = clipHalf(T, (X) => (-sg * (dx * (X[1] - A[1]) - dy * (X[0] - A[0]))) / l - ctx.kerf);
  if (out.length < 3) return null;
  const b = bbox(out);
  return Math.min(b[1] - b[0], b[3] - b[2]) >= ctx.minOffcut ? out : null;
}

/**
 * Réemploi pour les formes non rectangulaires (hexagone, octogone, Hongrie) : chaque pièce va dans la plus
 * petite chute où elle tient par une rotation de symétrie, sinon dans un nouveau carreau [polyReuse].
 */
export function polyReuse(
  cuts: { pc: Piece; i: number }[],
  newTile: () => CutTile,
  assign: (i: number, t: CutTile, reused: boolean) => void,
  ctx: CutContext,
): void {
  const stock: PolyStock[] = [];
  const ar = (pc: Piece) => pc.pparts!.reduce((t, p) => t + area(p), 0);
  cuts
    .slice()
    .sort((a, b) => ar(b.pc) - ar(a.pc))
    .forEach(({ pc, i }) => {
      const angs = symmetryAngles(pc.shape, ctx.orientation);
      const fits = (poly: Polygon) =>
        angs.some((an) => {
          const c = Math.cos(an),
            s2 = Math.sin(an);
          return pc.pparts!.every((p) =>
            p.every((q) => insideConvex([q[0] * c - q[1] * s2, q[0] * s2 + q[1] * c], poly)),
          );
        });
      let bi = -1,
        bA = Infinity;
      stock.forEach((s0, k) => {
        if (s0.area < bA && fits(s0.poly)) {
          bi = k;
          bA = s0.area;
        }
      });
      if (bi >= 0) {
        const s0 = stock.splice(bi, 1)[0]!;
        assign(i, s0.tile, true);
        return;
      }
      const t = newTile();
      assign(i, t, false);
      if (pc.pparts!.length === 1) {
        const rem = polyComplement(pc.pparts![0]!, pc.tpoly!, ctx);
        if (rem) stock.push({ type: 'poly', poly: rem, area: area(rem), tile: t });
      }
    });
}
