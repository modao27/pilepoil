import { EPS, SIDES } from '../constants';
import { area, bbox, insideConvex } from '../geometry/polygon';
import type { CutTile, Piece, Point, Polygon, SideFlags } from '../types';
import { rotateReq, rotations, type CutContext, type PolyStock, type RectStock } from './stock';

type AxisStart = 'a' | 'b';

/**
 * Côtés de départ possibles sur un axe : 'a' = pièce calée côté gauche/haut, 'b' = côté droit/bas.
 * nA, nB : la pièce exige un bord d'usine de ce côté ; fA, fB : la chute en a un [axis].
 */
export function axisStarts(
  nA: boolean,
  nB: boolean,
  len: number,
  olen: number,
  fA: boolean,
  fB: boolean,
): AxisStart[] | null {
  if (nA && nB) return Math.abs(len - olen) < EPS && fA && fB ? ['a'] : null;
  if (nA) return fA ? ['a'] : null;
  if (nB) return fB ? ['b'] : null;
  return fA && !fB ? ['b', 'a'] : ['a', 'b'];
}

const usable = (ctx: CutContext) => (r: RectStock) => r.w > 0 && r.h > 0 && Math.min(r.w, r.h) >= ctx.minOffcut;

/** Valeur d'une découpe : plus grande chute, bonus de 2 % par bord d'usine conservé. */
const keepScore = (o: RectStock[]) =>
  o.reduce((m, r) => {
    const nf = SIDES.filter((x) => r.f[x]).length;
    return Math.max(m, r.area * (1 + nf * 0.02));
  }, 0);

/** Découpe guillotine d'une pièce w × h dans O : coupe verticale ou horizontale d'abord, on garde la meilleure [cutRect]. */
export function cutRect(
  O: RectStock,
  sx: AxisStart,
  sy: AxisStart,
  w: number,
  h: number,
  ctx: CutContext,
  tile: CutTile,
): RectStock[] {
  const k = ctx.kerf;
  const mk = (rw: number, rh: number, xn: boolean, xf: boolean, yn: boolean, yf: boolean): RectStock => ({
    type: 'rect',
    w: rw,
    h: rh,
    area: rw * rh,
    tile,
    f: { L: sx === 'a' ? xn : xf, R: sx === 'a' ? xf : xn, T: sy === 'a' ? yn : yf, B: sy === 'a' ? yf : yn },
  });
  const fxn = sx === 'a' ? O.f.L : O.f.R,
    fxf = sx === 'a' ? O.f.R : O.f.L;
  const fyn = sy === 'a' ? O.f.T : O.f.B,
    fyf = sy === 'a' ? O.f.B : O.f.T;
  const ok = usable(ctx);
  const V = [mk(O.w - w - k, O.h, false, fxf, fyn, fyf), mk(w, O.h - h - k, fxn, false, false, fyf)].filter(ok);
  const Hh = [mk(O.w, O.h - h - k, fxn, fxf, false, fyf), mk(O.w - w - k, h, false, fxf, fyn, false)].filter(ok);
  return keepScore(V) >= keepScore(Hh) ? V : Hh;
}

/** Meilleure façon de tailler une pièce pw × ph dans une chute rectangulaire, ou null [placeRect]. */
export function placeRect(
  pw: number,
  ph: number,
  req: SideFlags,
  O: RectStock,
  ctx: CutContext,
): { rems: RectStock[]; score: number } | null {
  let best: { rems: RectStock[]; score: number } | null = null;
  for (const r of rotations(ctx.orientation)) {
    const w = r % 2 ? ph : pw,
      h = r % 2 ? pw : ph,
      q = rotateReq(req, r);
    if (w > O.w + EPS || h > O.h + EPS) continue;
    const xs = axisStarts(q.L, q.R, w, O.w, O.f.L, O.f.R),
      ys = axisStarts(q.T, q.B, h, O.h, O.f.T, O.f.B);
    if (!xs || !ys) continue;
    for (const sx of xs) {
      for (const sy of ys) {
        const rems = cutRect(O, sx, sy, Math.min(w, O.w), Math.min(h, O.h), ctx, O.tile);
        const score =
          rems.reduce((m, x) => Math.max(m, x.area * (1 + SIDES.filter((d) => x.f[d]).length * 0.02)), 0) +
          rems.reduce((t, x) => t + x.area, 0) * 1e-3;
        if (!best || score > best.score) best = { rems, score };
      }
    }
  }
  return best;
}

/** Une pièce tient-elle dans une chute polygonale ? (carreau de W × H) [placePoly] */
export function placeInPoly(pc: Piece, s: PolyStock, W: number, H: number, ctx: CutContext): boolean {
  if (pc.rect) {
    for (const r of rotations(ctx.orientation)) {
      const w = r % 2 ? pc.ph : pc.pw,
        h = r % 2 ? pc.pw : pc.ph,
        q = rotateReq(pc.req, r);
      if (w > W + EPS || h > H + EPS) continue;
      for (const [x, y] of [
        [0, 0],
        [W - w, 0],
        [0, H - h],
        [W - w, H - h],
      ] as const) {
        const on = { L: x < EPS, R: x + w > W - EPS, T: y < EPS, B: y + h > H - EPS };
        if (SIDES.some((d) => q[d] && !on[d])) continue;
        const corners: Point[] = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ];
        if (corners.every((p) => insideConvex(p, s.poly))) return true;
      }
    }
    return false;
  }
  if (pc.tf!.every((q) => insideConvex(q, s.poly))) return true;
  if (ctx.orientation !== 'none' && pc.tf!.every((q) => insideConvex([W - q[0], H - q[1]], s.poly))) return true;
  return false;
}

/** Arêtes de P qui ne sont pas sur le bord du carreau W × H. */
export function interiorEdges(P: Polygon, W: number, H: number): [Point, Point][] {
  const out: [Point, Point][] = [];
  const on = (A: Point, B: Point) =>
    (Math.abs(A[0]) < EPS && Math.abs(B[0]) < EPS) ||
    (Math.abs(A[0] - W) < EPS && Math.abs(B[0] - W) < EPS) ||
    (Math.abs(A[1]) < EPS && Math.abs(B[1]) < EPS) ||
    (Math.abs(A[1] - H) < EPS && Math.abs(B[1] - H) < EPS);
  for (let i = 0; i < P.length; i++) {
    const A = P[i]!,
      B = P[(i + 1) % P.length]!;
    if (!on(A, B) && Math.hypot(B[0] - A[0], B[1] - A[1]) > EPS) out.push([A, B]);
  }
  return out;
}

/**
 * Chute d'une coupe biaise à une seule coupe droite : complément polygonal du carreau, moins le kerf.
 * null si la pièce a plusieurs coupes ; [] si la chute est trop petite [complement].
 */
export function biasComplement(pc: Piece, W: number, H: number, ctx: CutContext, tile: CutTile): PolyStock[] | null {
  const tf = pc.tf!;
  const ie = interiorEdges(tf, W, H);
  if (ie.length !== 1) return null;
  const [A, B] = ie[0]!,
    dx = B[0] - A[0],
    dy = B[1] - A[1],
    l = Math.hypot(dx, dy);
  const C = tf.reduce<Point>((t, q) => [t[0] + q[0] / tf.length, t[1] + q[1] / tf.length], [0, 0]);
  const sg = Math.sign(dx * (C[1] - A[1]) - dy * (C[0] - A[0])) || 1;
  const f = (X: Point) => (-sg * (dx * (X[1] - A[1]) - dy * (X[0] - A[0]))) / l - ctx.kerf;
  const rect: Polygon = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];
  const out: Polygon = [];
  for (let i = 0; i < 4; i++) {
    const P = rect[(i + 3) % 4]!,
      Q = rect[i]!,
      fp = f(P),
      fq = f(Q);
    if (fq >= 0) {
      if (fp < 0) {
        const t = fp / (fp - fq);
        out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
      }
      out.push(Q);
    } else if (fp >= 0) {
      const t = fp / (fp - fq);
      out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
    }
  }
  if (out.length >= 3) {
    const b = bbox(out);
    if (Math.min(b[1] - b[0], b[3] - b[2]) >= ctx.minOffcut)
      return [{ type: 'poly', poly: out, area: area(out), tile }];
  }
  return [];
}

/** Dimensions de la pièce dans le repère carreau [dims]. */
export function pieceDims(pc: Piece): [number, number] {
  if (pc.rect) return [pc.pw, pc.ph];
  const b = bbox(pc.tf!);
  return [b[1] - b[0], b[3] - b[2]];
}

/** Aire de carreau consommée par la pièce, pour l'ordre de traitement. */
export function pieceNeed(pc: Piece): number {
  return pc.rect ? pc.pw * pc.ph : area(pc.tf!);
}
