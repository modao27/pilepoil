/**
 * Anneaux d'une région (règle non nulle, contours > 0, trous < 0) : regroupement en composantes, et fusion
 * d'un trou dans son contour par une fente (une pièce percée reste un seul polygone), test « entièrement dans la
 * région ». Partagé par le parquet et le carrelage. Pur.
 */
import { pointInPolygon, signedArea } from './polygon';
import type { Point, Polygon } from './types';

export interface Component {
  outer: Polygon;
  holes: Polygon[];
}

/** Contours et leurs trous. */
export function components(rings: Polygon[]): Component[] {
  const outers = rings.filter((r) => signedArea(r) > 0).map((outer) => ({ outer, holes: [] as Polygon[] }));
  for (const h of rings.filter((r) => signedArea(r) < 0)) {
    const c = outers.find((o) => pointInPolygon(h[0]!, o.outer));
    if (c) c.holes.push(h);
  }
  return outers;
}

/**
 * Un seul anneau : chaque trou est relié au contour par une fente horizontale, vers la gauche depuis son
 * sommet le plus à gauche. L'aire (signée) est celle du contour moins les trous.
 */
export function keyhole(c: Component): Polygon {
  let ring = c.outer;
  for (const hole of [...c.holes].sort((a, b) => minX(a) - minX(b))) {
    const hi = hole.reduce((b, p, i) => (p[0] < hole[b]![0] ? i : b), 0);
    const h = hole[hi]!;
    // premier bord du contour rencontré vers la gauche, à la hauteur de h
    let best: { i: number; p: Point } | null = null;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!,
        b = ring[(i + 1) % ring.length]!;
      if (a[1] > h[1] === b[1] > h[1] || a[1] === b[1]) continue;
      const x = a[0] + ((h[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x <= h[0] && (!best || x > best.p[0])) best = { i, p: [x, h[1]] };
    }
    if (!best) continue;
    const around = [...hole.slice(hi), ...hole.slice(0, hi), h];
    ring = [...ring.slice(0, best.i + 1), best.p, ...around, best.p, ...ring.slice(best.i + 1)];
  }
  return ring;
}

const minX = (r: Polygon) => Math.min(...r.map((p) => p[0]));

/**
 * Le polygone est-il entièrement dans la surface (anneaux extérieurs d'aire > 0, trous d'aire < 0) ? Tous ses
 * sommets dedans et aucune arête de la surface ne coupe les siennes. Sert à éviter un découpage inutile.
 */
export function insideRegion(poly: Polygon, rings: Polygon[]): boolean {
  const xs = poly.map((p) => p[0]),
    ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const inRegion = (p: Point) => {
    let n = 0;
    for (const r of rings) if (pointInPolygon(p, r)) n += signedArea(r) > 0 ? 1 : -1;
    return n > 0;
  };
  if (!poly.every(inRegion)) return false;
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i]!,
        b = r[(i + 1) % r.length]!;
      // arêtes loin de la boîte du polygone : rien à tester
      if (
        Math.max(a[0], b[0]) < x0 ||
        Math.min(a[0], b[0]) > x1 ||
        Math.max(a[1], b[1]) < y0 ||
        Math.min(a[1], b[1]) > y1
      )
        continue;
      for (let j = 0; j < poly.length; j++) if (crosses(a, b, poly[j]!, poly[(j + 1) % poly.length]!)) return false;
    }
  return true;
}

/** Les segments [a, b] et [c, d] se touchent-ils (y compris en un bout) ? */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a),
    d2 = o(c, d, b),
    d3 = o(a, b, c),
    d4 = o(a, b, d);
  const eps = 1e-9;
  if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps)))
    return true;
  const on = (p: Point, q: Point, r: Point) =>
    Math.min(p[0], q[0]) - eps <= r[0] &&
    r[0] <= Math.max(p[0], q[0]) + eps &&
    Math.min(p[1], q[1]) - eps <= r[1] &&
    r[1] <= Math.max(p[1], q[1]) + eps;
  return (
    (Math.abs(d1) <= eps && on(c, d, a)) ||
    (Math.abs(d2) <= eps && on(c, d, b)) ||
    (Math.abs(d3) <= eps && on(a, b, c)) ||
    (Math.abs(d4) <= eps && on(a, b, d))
  );
}
