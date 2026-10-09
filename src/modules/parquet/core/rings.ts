/**
 * Anneaux d'une région (règle non nulle, contours > 0, trous < 0) : regroupement en composantes, et fusion
 * d'un trou dans son contour par une fente (une pièce de lame percée reste un seul polygone). Pur.
 */
import { pointInPolygon, signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';

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
