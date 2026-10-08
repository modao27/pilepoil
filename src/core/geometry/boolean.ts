/**
 * Opérations booléennes et décalage sur polygones quelconques avec trous (docs/BOITE.md §3).
 * Enveloppe de clipper2-ts : calcul en entiers au 1/100 mm, déterministe, sans DOM (worker).
 * Le carrelage garde ses propres découpes (polygon.ts) : la parité n'en dépend pas.
 */
import {
  difference as clipDifference,
  EndType,
  FillRule,
  inflatePaths,
  intersect as clipIntersect,
  JoinType,
  union as clipUnion,
  type Paths64,
} from 'clipper2-ts';
import { signedArea } from './polygon';
import type { Polygon } from './types';

/**
 * Région du plan : liste d'anneaux, règle non nulle. Contours extérieurs en sens horaire à l'écran
 * (aire signée > 0), trous en sens inverse. Les résultats suivent la même convention.
 */
export type Region = Polygon[];

export type Join = 'miter' | 'round' | 'square';

/** Unités de calcul par mm. */
const SCALE = 100;
/** Écart maximal entre un arc arrondi et son tracé en segments, mm. */
const ARC_TOLERANCE = 0.1;
/** Au-delà de 2 × le décalage, un angle vif est coupé (évite les pointes infinies). */
const MITER_LIMIT = 2;

const JOINS: Record<Join, JoinType> = { miter: JoinType.Miter, round: JoinType.Round, square: JoinType.Square };

function toPaths(r: Region): Paths64 {
  return r.map((ring) => ring.map(([x, y]) => ({ x: Math.round(x * SCALE), y: Math.round(y * SCALE) })));
}

function fromPaths(paths: Paths64): Region {
  return paths.filter((p) => p.length >= 3).map((p) => p.map((q): [number, number] => [q.x / SCALE, q.y / SCALE]));
}

export function union(a: Region, b: Region): Region {
  return fromPaths(clipUnion(toPaths(a), toPaths(b), FillRule.NonZero));
}

export function intersection(a: Region, b: Region): Region {
  return fromPaths(clipIntersect(toPaths(a), toPaths(b), FillRule.NonZero));
}

export function difference(a: Region, b: Region): Region {
  return fromPaths(clipDifference(toPaths(a), toPaths(b), FillRule.NonZero));
}

/** Décale le bord de `delta` mm : > 0 agrandit la région, < 0 la rétrécit (trous agrandis). */
export function offset(r: Region, delta: number, join: Join = 'miter'): Region {
  if (delta === 0) return union(r, []);
  return fromPaths(
    inflatePaths(toPaths(r), delta * SCALE, JOINS[join], EndType.Polygon, MITER_LIMIT, ARC_TOLERANCE * SCALE),
  );
}

/** Aire d'une région (trous déduits), mm². */
export function regionArea(r: Region): number {
  return r.reduce((s, ring) => s + signedArea(ring), 0);
}
