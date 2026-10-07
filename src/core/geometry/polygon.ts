import { EPS } from '../constants';
import type { BBox, Point, Polygon } from '../types';

export function signedArea(p: Polygon): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function area(p: Polygon): number {
  return Math.abs(signedArea(p));
}

export function bbox(p: Polygon): BBox {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const q of p) {
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }
  return [x0, x1, y0, y1];
}

/** Moyenne des sommets. */
export function centroid(p: Polygon): Point {
  return p.reduce<Point>((t, q) => [t[0] + q[0] / p.length, t[1] + q[1] / p.length], [0, 0]);
}

/** Rétracte un polygone convexe de d ; renvoie [] s'il disparaît. */
export function inset(p: Polygon, d: number): Polygon {
  if (d <= 0) return p;
  const pts = signedArea(p) < 0 ? p.slice().reverse() : p,
    n = pts.length,
    L: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const P = pts[i],
      Q = pts[(i + 1) % n],
      dx = Q[0] - P[0],
      dy = Q[1] - P[1],
      l = Math.hypot(dx, dy);
    L.push([P[0] - (dy / l) * d, P[1] + (dx / l) * d, dx, dy]);
  }
  const out: Polygon = [];
  for (let i = 0; i < n; i++) {
    const a = L[(i - 1 + n) % n],
      b = L[i],
      den = a[2] * b[3] - a[3] * b[2];
    if (Math.abs(den) < 1e-12) {
      out.push([b[0], b[1]]);
      continue;
    }
    const t = ((b[0] - a[0]) * b[3] - (b[1] - a[1]) * b[2]) / den;
    out.push([a[0] + t * a[2], a[1] + t * a[3]]);
  }
  return signedArea(out) > 0 ? out : [];
}

/** Découpe par une boîte alignée (Sutherland-Hodgman). Bornes infinies permises. */
export function clipBox(pts: Polygon, X0: number, X1: number, Y0: number, Y1: number): Polygon {
  const ix = (P: Point, Q: Point, X: number): Point => {
    const t = (X - P[0]) / (Q[0] - P[0]);
    return [X, P[1] + t * (Q[1] - P[1])];
  };
  const iy = (P: Point, Q: Point, Y: number): Point => {
    const t = (Y - P[1]) / (Q[1] - P[1]);
    return [P[0] + t * (Q[0] - P[0]), Y];
  };
  const edges: [(p: Point) => boolean, (P: Point, Q: Point) => Point][] = [
    [(p) => p[0] >= X0, (P, Q) => ix(P, Q, X0)],
    [(p) => p[0] <= X1, (P, Q) => ix(P, Q, X1)],
    [(p) => p[1] >= Y0, (P, Q) => iy(P, Q, Y0)],
    [(p) => p[1] <= Y1, (P, Q) => iy(P, Q, Y1)],
  ];
  let out = pts;
  for (const [inside, inter] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const P = src[(i + src.length - 1) % src.length],
        Q = src[i],
        qi = inside(Q),
        pi = inside(P);
      if (qi) {
        if (!pi) out.push(inter(P, Q));
        out.push(Q);
      } else if (pi) out.push(inter(P, Q));
    }
    if (!out.length) return out;
  }
  return out;
}

export function clipRect(pts: Polygon, W: number, H: number): Polygon {
  return clipBox(pts, 0, W, 0, H);
}

/** Garde la partie où f ≥ 0 (f affine). */
export function clipHalf(poly: Polygon, f: (p: Point) => number): Polygon {
  const out: Polygon = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[(i + poly.length - 1) % poly.length],
      Q = poly[i],
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
  return out;
}

/** Point dans un polygone convexe, avec tolérance EPS vers l'extérieur. */
export function insideConvex(q: Point, poly: Polygon): boolean {
  const o = signedArea(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i],
      B = poly[(i + 1) % poly.length],
      dx = B[0] - A[0],
      dy = B[1] - A[1],
      l = Math.hypot(dx, dy);
    if (l < 1e-9) continue;
    if ((o * (dx * (q[1] - A[1]) - dy * (q[0] - A[0]))) / l < -EPS) return false;
  }
  return true;
}

/** P est sur la droite (C, D) à EPS près. */
export function onLine(P: Point, C: Point, D: Point): boolean {
  const dx = D[0] - C[0],
    dy = D[1] - C[1],
    l = Math.hypot(dx, dy);
  return l > 1e-9 && Math.abs(dx * (P[1] - C[1]) - dy * (P[0] - C[0])) / l < EPS;
}

/** Test pair-impair, pour les polygones quelconques. */
export function pointInPolygon(pt: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const a = poly[i],
      b = poly[k];
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

export function rectPoly(x: number, y: number, w: number, h: number): Polygon {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}
