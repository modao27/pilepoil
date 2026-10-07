import { EPS } from '../constants';
import { area, bbox, centroid, clipBox, clipRect, inset, onLine } from '../geometry/polygon';
import { openingRect, zoneCutouts } from '../layout/openings';
import type { ZoneRect } from '../layout/zones';
import { pattern } from '../patterns/registry';
import type { PatternGeo } from '../patterns/types';
import type {
  CornerSpec,
  Point,
  Polygon,
  RawPiece,
  Segment,
  Side,
  SideFlags,
  SurfaceSpec,
  TileShape,
  ZoneSpec,
} from '../types';

export interface ZoneStats {
  full: number;
  cut: number;
  tA: number;
}

export interface ZoneBuild {
  /** Origine du motif dans le repère surface. */
  O: Point;
  stats: Partial<Record<'main' | 'cab', ZoneStats>>;
  g: PatternGeo;
}

/**
 * Construit les pièces d'une zone [buildZone] :
 * 1. carreaux du motif → repère zone, découpe par le rectangle de zone ;
 * 2. soustraction des ouvertures (sauf prises) en 4 régions convexes ; plusieurs parties = une pièce « encoche » ;
 * 3. découpe aux angles de mur ; 4. prises → perçage ;
 * 5. classement entière / coupe fine ; 6. repère carreau canonique, bords d'usine requis, coupes apparentes.
 */
export function buildZone(s: SurfaceSpec, z: ZoneSpec, zi: number, rc: ZoneRect, list: RawPiece[]): ZoneBuild | null {
  if (rc.w < 0.5 || rc.h < 0.5) return null;
  const j = s.joint,
    P = pattern(z.pattern),
    a = z.tile.width,
    b = z.tile.height;
  const g = P.geo(a, b, j),
    th = (z.angle * Math.PI) / 180,
    c = Math.cos(th),
    sn = Math.sin(th);
  const ref = z.start === 'corner' ? g.tl : z.start === 'tile' ? g.ctr : g.jn;
  const sh: Point = [-ref[0], -ref[1]];
  const O: Point = [
    (z.start === 'corner' ? 0 : rc.w / 2) + z.offsetX,
    (z.start === 'corner' ? 0 : rc.h / 2) + z.offsetY,
  ];
  const toW = (x: number, y: number): Point => {
    x += sh[0];
    y += sh[1];
    return [O[0] + x * c - y * sn, O[1] + x * sn + y * c];
  };
  const toL = (X: number, Y: number): Point => {
    const u = X - O[0],
      v = Y - O[1];
    return [u * c + v * sn - sh[0], -u * sn + v * c - sh[1]];
  };
  const corners: Point[] = [
    [0, 0],
    [rc.w, 0],
    [rc.w, rc.h],
    [0, rc.h],
  ];
  const bb = bbox(corners.map((q) => toL(q[0], q[1])));
  const cells = P.generate(a, b, j, bb, g);
  const stats: ZoneBuild['stats'] = {};
  const FX: CornerSpec[] =
    s.kind === 'floor'
      ? []
      : s.corners
          .map((f) => ({ ...f, x: f.x - rc.x }))
          .filter((o) => o.x > EPS && o.x < rc.w - EPS)
          .sort((p, q) => p.x - q.x);
  const RZ = zoneCutouts(s.openings, s.height, rc);

  for (const cell of cells) {
    const tile = j > 0 ? inset(cell.p, j / 2) : cell.p;
    if (tile.length < 3) continue;
    const tA = area(tile);
    const cp0 = clipRect(
      tile.map((q) => toW(q[0], q[1])),
      rc.w,
      rc.h,
    );
    if (cp0.length < 3) continue;
    let parts: Polygon[] = [cp0];
    for (const r of RZ) {
      const np: Polygon[] = [];
      for (const p of parts) {
        const q = bbox(p);
        if (q[0] >= r.x1 - EPS || q[1] <= r.x0 + EPS || q[2] >= r.y1 - EPS || q[3] <= r.y0 + EPS) {
          np.push(p);
          continue;
        }
        for (const bx of [
          [-Infinity, r.x0, -Infinity, Infinity],
          [r.x1, Infinity, -Infinity, Infinity],
          [r.x0, r.x1, -Infinity, r.y0],
          [r.x0, r.x1, r.y1, Infinity],
        ] as const) {
          const c2 = clipBox(p, bx[0], bx[1], bx[2], bx[3]);
          if (c2.length >= 3 && area(c2) > 1) np.push(c2);
        }
      }
      parts = np;
    }
    if (!parts.length) continue;
    let groupsP: Polygon[][] = [parts];
    if (FX.length) {
      const bs = [-Infinity, ...FX.map((o) => o.x), Infinity];
      groupsP = [];
      for (let i = 0; i < bs.length - 1; i++) {
        const sub = parts
          .map((p) => clipBox(p, bs[i]!, bs[i + 1]!, -Infinity, Infinity))
          .filter((p) => p.length >= 3 && area(p) > 1);
        if (sub.length) groupsP.push(sub);
      }
    }
    for (const gp of groupsP) {
      const piece = buildPiece(s, z, zi, rc, cell, tile, tA, gp, FX, RZ, toW, toL);
      if (!piece) continue;
      list.push(piece);
      const k = stats[cell.kind] ?? (stats[cell.kind] = { full: 0, cut: 0, tA });
      if (piece.full) k.full++;
      else k.cut++;
    }
  }
  return { O: [O[0] + rc.x, O[1] + rc.y], stats, g };
}

function buildPiece(
  s: SurfaceSpec,
  z: ZoneSpec,
  zi: number,
  rc: ZoneRect,
  cell: { par: number; kind: 'main' | 'cab' },
  tile: Polygon,
  tA: number,
  parts: Polygon[],
  FX: CornerSpec[],
  RZ: ReturnType<typeof zoneCutouts>,
  toW: (x: number, y: number) => Point,
  toL: (x: number, y: number) => Point,
): RawPiece | null {
  const ar = parts.reduce((t, p) => t + area(p), 0),
    ratio = ar / tA;
  if (ratio < 1e-4) return null;
  const multi = parts.length > 1,
    tb = bbox(tile);
  const fw = tb[1] - tb[0],
    fh = tb[3] - tb[2];
  const pShape = pattern(z.pattern).shape;
  const shape: TileShape = pShape === 'rect' ? 'rect' : cell.kind === 'cab' ? 'cab' : pShape;
  const rotT = fh > fw + 0.01;
  let tW = fw,
    tH = fh;
  if (shape === 'rect') {
    tW = Math.max(fw, fh);
    tH = Math.min(fw, fh);
  }
  const locs = parts.map((p) => p.map((q) => toL(q[0], q[1])));
  const tfs =
    shape === 'rect'
      ? locs.map((L) => L.map((q): Point => (rotT ? [q[1] - tb[2], tb[1] - q[0]] : [q[0] - tb[0], q[1] - tb[2]])))
      : null;
  const allP = ([] as Point[]).concat(...(tfs ?? locs)),
    ub = bbox(allP);
  const pw = ub[1] - ub[0],
    ph = ub[3] - ub[2];
  let tf: Polygon | null = null;
  if (shape === 'rect') {
    tf = multi
      ? [
          [ub[0], ub[2]],
          [ub[1], ub[2]],
          [ub[1], ub[3]],
          [ub[0], ub[3]],
        ]
      : tfs![0]!;
  }
  let tpoly: Polygon | null = null,
    pparts: Polygon[] | null = null;
  if (shape !== 'rect') {
    const C = centroid(tile);
    tpoly = tile.map((q) => [q[0] - C[0], q[1] - C[1]]);
    pparts = locs.map((L) => L.map((q): Point => [q[0] - C[0], q[1] - C[1]]));
  }
  const full = ratio > 0.999,
    minD = Math.min(
      ...(tfs ?? locs).map((Pl) => {
        const q = bbox(Pl);
        return Math.min(q[1] - q[0], q[3] - q[2]);
      }),
    );
  const thin = !full && (minD < Math.max(20, Math.min(fw, fh) / 4) || ratio < 0.08);
  const req: SideFlags = { L: false, R: false, T: false, B: false },
    vis: Segment[] = [],
    outline: Segment[] = [];

  const zside = (A: Point, B: Point): Side | null =>
    Math.abs(A[0]) < EPS && Math.abs(B[0]) < EPS
      ? 'L'
      : Math.abs(A[0] - rc.w) < EPS && Math.abs(B[0] - rc.w) < EPS
        ? 'R'
        : Math.abs(A[1]) < EPS && Math.abs(B[1]) < EPS
          ? 'T'
          : Math.abs(A[1] - rc.h) < EPS && Math.abs(B[1] - rc.h) < EPS
            ? 'B'
            : null;
  /** Bord de zone caché : bord de surface masqué, ou jonction de zones recouverte. */
  const hidden = (sd: Side): boolean => {
    const surf =
      sd === 'L'
        ? rc.x < EPS
        : sd === 'R'
          ? rc.x + rc.w > s.width - EPS
          : sd === 'T'
            ? rc.y < EPS
            : rc.y + rc.h > s.height - EPS;
    return surf ? !!s.hiddenEdges[sd] : !!s.junctionsCovered;
  };
  /** Arête intérieure entre deux parties d'un même carreau (pas un vrai bord). */
  const seam = (A: Point, B: Point, i: number): boolean => {
    for (let k2 = 0; k2 < parts.length; k2++) {
      if (k2 === i) continue;
      const Pk = parts[k2]!;
      for (let m = 0; m < Pk.length; m++) {
        const C = Pk[m]!,
          D = Pk[(m + 1) % Pk.length]!;
        if (!onLine(A, C, D) || !onLine(B, C, D)) continue;
        const dx = D[0] - C[0],
          dy = D[1] - C[1],
          l2 = dx * dx + dy * dy;
        const t1 = ((A[0] - C[0]) * dx + (A[1] - C[1]) * dy) / l2,
          t2 = ((B[0] - C[0]) * dx + (B[1] - C[1]) * dy) / l2;
        if ((Math.min(Math.max(t1, t2), 1) - Math.max(Math.min(t1, t2), 0)) * Math.sqrt(l2) > EPS) return true;
      }
    }
    return false;
  };
  const resEdge = (A: Point, B: Point) => {
    for (const r of RZ) {
      const my = (A[1] + B[1]) / 2,
        mx = (A[0] + B[0]) / 2;
      if (
        Math.abs(A[0] - B[0]) < EPS &&
        (Math.abs(A[0] - r.x0) < EPS || Math.abs(A[0] - r.x1) < EPS) &&
        my > r.y0 - EPS &&
        my < r.y1 + EPS
      )
        return r;
      if (
        Math.abs(A[1] - B[1]) < EPS &&
        (Math.abs(A[1] - r.y0) < EPS || Math.abs(A[1] - r.y1) < EPS) &&
        mx > r.x0 - EPS &&
        mx < r.x1 + EPS
      )
        return r;
    }
    return null;
  };
  const tside = (p: Point, q: Point): Side | null =>
    Math.abs(p[0]) < EPS && Math.abs(q[0]) < EPS
      ? 'L'
      : Math.abs(p[0] - tW) < EPS && Math.abs(q[0] - tW) < EPS
        ? 'R'
        : Math.abs(p[1]) < EPS && Math.abs(q[1]) < EPS
          ? 'T'
          : Math.abs(p[1] - tH) < EPS && Math.abs(q[1] - tH) < EPS
            ? 'B'
            : null;
  const W2 = (q: Point): Point => [q[0] + rc.x, q[1] + rc.y];

  let notch = false,
    atFold = false;
  parts.forEach((cp, i) => {
    for (let e = 0; e < cp.length; e++) {
      const A = cp[e]!,
        B = cp[(e + 1) % cp.length]!;
      if (Math.hypot(B[0] - A[0], B[1] - A[1]) < EPS) continue;
      if (multi && seam(A, B, i)) continue;
      outline.push([W2(A), W2(B)]);
      const ts = tfs ? tside(tfs[i]![e]!, tfs[i]![(e + 1) % cp.length]!) : null;
      const fe = Math.abs(A[0] - B[0]) < EPS ? FX.find((o) => Math.abs(o.x - A[0]) < EPS) : undefined;
      if (fe) {
        atFold = true;
        if (!full && !ts && fe.type === 'out' && !fe.covered) vis.push([W2(A), W2(B)]);
        continue;
      }
      const rs = resEdge(A, B);
      if (rs) {
        notch = true;
        if (!full && !ts && !rs.covered) vis.push([W2(A), W2(B)]);
        continue;
      }
      const zs = zside(A, B);
      if (!zs) {
        if (ts) req[ts] = true;
      } else if (!full && !ts && !hidden(zs)) vis.push([W2(A), W2(B)]);
    }
  });
  const wparts = parts.map((p) => p.map(W2));
  let drill = 0;
  for (const o of s.openings) {
    if (o.type !== 'socket') continue;
    const r = openingRect(o, s.height);
    if (
      wparts.some((p) => {
        const q = bbox(p);
        return q[0] < r.x1 && q[1] > r.x0 && q[2] < r.y1 && q[3] > r.y0;
      })
    )
      drill++;
  }
  const imgO: [Point, Point, Point] =
    tile.length === 4 && shape === 'rect' && rotT
      ? [
          [tb[1], tb[2]],
          [tb[1], tb[3]],
          [tb[0], tb[2]],
        ]
      : [
          [tb[0], tb[2]],
          [tb[1], tb[2]],
          [tb[0], tb[3]],
        ];
  const img = imgO.map((q) => W2(toW(q[0], q[1]))) as [Point, Point, Point];

  return {
    zone: zi,
    parts: wparts,
    outline,
    vis,
    full,
    thin,
    atFold,
    drill,
    notch: notch && multi,
    rect: !multi && Math.abs(ar - pw * ph) / ar < 0.003,
    img,
    pw,
    ph,
    fw,
    fh,
    minD,
    req,
    par: cell.par,
    kind: cell.kind,
    shape,
    tf,
    tW,
    tH,
    tA,
    tpoly,
    pparts,
    reveal: null,
    plinth: false,
  };
}
