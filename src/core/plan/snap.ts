/** Aimantation de l'éditeur de plan : grille, angles droits, placement des nouvelles pièces. Pur, mm. */
import { pointInPolygon } from '../geometry/polygon';
import type { Point, Polygon } from '../geometry/types';
import type { Plan } from './types';

/** Pas de la grille par défaut, mm (docs/BOITE.md §9). */
export const GRID = 10;

const round = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Point aimanté : d'abord à l'axe d'un voisin (même x ou même y, angle droit) si l'écart est inférieur à
 * `tolerance` mm, sinon à la grille. Les voisins sont dans le même repère que `p`.
 */
export function snapPoint(p: Point, neighbors: readonly Point[], tolerance: number, grid = GRID): Point {
  let x = round(p[0], grid),
    y = round(p[1], grid);
  let bx = tolerance,
    by = tolerance;
  for (const q of neighbors) {
    const dx = Math.abs(q[0] - p[0]),
      dy = Math.abs(q[1] - p[1]);
    if (dx < bx) [bx, x] = [dx, q[0]];
    if (dy < by) [by, y] = [dy, q[1]];
  }
  return [x, y];
}

/** Boîte englobante du plan d'ensemble [x0, x1, y0, y1], origines des pièces comprises ; null si vide. */
export function planBounds(plan: Plan): [number, number, number, number] | null {
  let b: [number, number, number, number] | null = null;
  for (const r of plan.rooms)
    for (const [px, py] of r.outline) {
      const x = r.origin[0] + px,
        y = r.origin[1] + py;
      b = b ? [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], y), Math.max(b[3], y)] : [x, x, y, y];
    }
  return b;
}

/** Origine d'une nouvelle pièce : à droite des pièces existantes, à 1 m, alignée en haut. */
export function placeNewRoom(plan: Plan, gap = 1000): Point {
  const b = planBounds(plan);
  return b ? [round(b[1] + gap, GRID), round(b[2], GRID)] : [0, 0];
}

/** Contour en sens horaire à l'écran (aire signée > 0) : retourné s'il est dans l'autre sens. */
export function clockwise(outline: Polygon): Polygon {
  let s = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s < 0 ? [...outline].reverse() : outline;
}

/**
 * Point où écrire le nom d'une pièce : le plus éloigné des murs parmi une grille de candidats intérieurs
 * (pôle d'inaccessibilité approché). Le centre de gravité d'une pièce en L tombe près de l'angle rentrant.
 */
export function labelPoint(poly: Polygon, steps = 16): Point {
  const xs = poly.map((p) => p[0]),
    ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  let best: Point = [cx, cy],
    bestD = -1;
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++) {
      const p: Point = [x0 + ((i + 0.5) / steps) * (x1 - x0), y0 + ((j + 0.5) / steps) * (y1 - y0)];
      if (!pointInPolygon(p, poly)) continue;
      const d = edgeDistance(p, poly);
      // à distance égale (1 mm près), le plus proche du centre de la boîte
      const closer = Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(best[0] - cx, best[1] - cy);
      if (d > bestD + 1 || (d > bestD - 1 && closer)) [best, bestD] = [p, Math.max(d, bestD)];
    }
  return best;
}

function edgeDistance(p: Point, poly: Polygon): number {
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!,
      b = poly[(i + 1) % poly.length]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    m = Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return m;
}
