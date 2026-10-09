/** Géométrie des zones : contour d'une surface du plan, contour d'une zone (surface coupée par ses lignes). Pur. */
import { intersection, regionArea } from '../geometry/boolean';
import { signedArea } from '../geometry/polygon';
import type { Point, Polygon } from '../geometry/types';
import type { Plan, PlanRoom } from '../plan/types';
import { wallIndex, wallLength } from '../plan/walls';
import type { Cut, SurfaceRef, Zone } from './types';

/** Distance « infinie » des demi-plans, mm. */
const FAR = 1e7;

/** Demi-plan d'une ligne de découpe, en retrait de `gap` sur la ligne (polygone de grande taille). */
export function halfPlane(c: Cut, gap = 0): Polygon {
  const [a, b] = c.line;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: Point = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const n: Point = [-d[1] * c.side, d[0] * c.side];
  const at = (s: number, t: number): Point => [a[0] + d[0] * s + n[0] * t, a[1] + d[1] * s + n[1] * t];
  const ring = [at(-FAR, gap), at(FAR, gap), at(FAR, FAR), at(-FAR, FAR)];
  return signedArea(ring) < 0 ? ring.reverse() : ring;
}

const ring = (p: Polygon, sign: 1 | -1): Polygon => (Math.sign(signedArea(p)) === sign ? p : [...p].reverse());

export function findRoom(plan: Plan, id: string): PlanRoom | undefined {
  return plan.rooms.find((r) => r.id === id);
}

/**
 * Contour d'une surface : sol = contour de la pièce et obstacles en trous (repère de la pièce) ; mur = rectangle
 * longueur × hauteur de la pièce (repère du mur, y vers le haut). null si la pièce ou le mur n'existe plus.
 */
export function surfacePolygon(plan: Plan, s: SurfaceRef): Polygon[] | null {
  const room = findRoom(plan, s.room);
  if (!room) return null;
  if (s.wall == null) return [ring(room.outline, 1), ...room.obstacles.map((o) => ring(o.outline, -1))];
  const i = wallIndex(room, s.wall);
  if (i < 0) return null;
  const L = wallLength(room, i),
    H = room.height;
  return [
    [
      [0, 0],
      [L, 0],
      [L, H],
      [0, H],
    ],
  ];
}

/** Contour d'une zone ; null si sa surface n'existe plus. Vide si les lignes ne laissent rien. */
export function zoneRegion(plan: Plan, z: Pick<Zone, 'surface' | 'cuts'>): Polygon[] | null {
  const base = surfacePolygon(plan, z.surface);
  if (!base) return null;
  return z.cuts.reduce<Polygon[]>((r, c) => (r.length ? intersection(r, [halfPlane(c)]) : r), base);
}

/** Aire d'une zone, mm² (0 si elle n'existe plus). */
export function zoneArea(plan: Plan, z: Pick<Zone, 'surface' | 'cuts'>): number {
  const r = zoneRegion(plan, z);
  return r ? regionArea(r) : 0;
}

export const sameSurface = (a: SurfaceRef, b: SurfaceRef): boolean => a.room === b.room && a.wall === b.wall;

/** Clé d'une surface : `${pièce}~floor` ou `${pièce}~${mur}`. */
export const surfaceKey = (s: SurfaceRef): string => `${s.room}~${s.wall ?? 'floor'}`;
