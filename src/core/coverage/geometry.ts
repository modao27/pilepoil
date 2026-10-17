/** Géométrie des zones : contour d'une surface du plan, contour d'une zone (surface coupée par ses lignes). Pur. */
import { difference, intersection, regionArea } from '../geometry/boolean';
import { signedArea } from '../geometry/polygon';
import type { Point, Polygon } from '../geometry/types';
import type { Plan, PlanRoom } from '../plan/types';
import { floorHoles } from '../plan/equipment';
import { wallHeight } from '../plan/levels';
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
 * longueur × hauteur propre du mur, sinon celle de la pièce (repère du mur, y vers le haut). null si la pièce ou le mur n'existe plus.
 */
export function surfacePolygon(plan: Plan, s: SurfaceRef): Polygon[] | null {
  const room = findRoom(plan, s.room);
  if (!room) return null;
  if (s.wall == null) return [ring(room.outline, 1), ...floorHoles(room).map((o) => ring(o.outline, -1))];
  const i = wallIndex(room, s.wall);
  if (i < 0) return null;
  const L = wallLength(room, i),
    H = wallHeight(room, room.walls[i]!);
  return [
    [
      [0, 0],
      [L, 0],
      [L, H],
      [0, H],
    ],
  ];
}

/**
 * Contour d'une zone : la surface coupée par ses lignes, limitée à son contour `area`, privée de ses `holes` ;
 * null si sa surface n'existe plus. Vide si rien ne reste.
 */
export function zoneRegion(plan: Plan, z: Pick<Zone, 'surface' | 'cuts' | 'area' | 'holes'>): Polygon[] | null {
  const base = surfacePolygon(plan, z.surface);
  if (!base) return null;
  let r = z.cuts.reduce<Polygon[]>((acc, c) => (acc.length ? intersection(acc, [halfPlane(c)]) : acc), base);
  if (z.area && r.length) r = intersection(r, [ring(z.area, 1)]);
  if (z.holes?.length && r.length)
    r = difference(
      r,
      z.holes.map((h) => ring(h, 1)),
    );
  return r;
}

/** Aire d'une zone, mm² (0 si elle n'existe plus). */
export function zoneArea(plan: Plan, z: Pick<Zone, 'surface' | 'cuts' | 'area' | 'holes'>): number {
  const r = zoneRegion(plan, z);
  return r ? regionArea(r) : 0;
}

export const sameSurface = (a: SurfaceRef, b: SurfaceRef): boolean => a.room === b.room && a.wall === b.wall;

/** Clé d'une surface : `${pièce}~floor` ou `${pièce}~${mur}`. */
export const surfaceKey = (s: SurfaceRef): string => `${s.room}~${s.wall ?? 'floor'}`;

/**
 * Lignes d'une zone de mur carrelée de `from` à `to` mm au-dessus du sol (null : depuis le sol, jusqu'au
 * plafond). Repère du mur (y vers le haut) : côté 1 d'une ligne orientée vers +x = au-dessus. Aucune ligne si la
 * zone couvre toute la hauteur.
 */
export function wallSpanCuts(plan: Plan, s: SurfaceRef, from: number | null, to: number | null): Cut[] {
  const rect = surfacePolygon(plan, s);
  if (!rect || s.wall == null) return [];
  const length = Math.max(...rect[0]!.map((p) => p[0]));
  const ceiling = Math.max(...rect[0]!.map((p) => p[1]));
  const line = (y: number): Cut['line'] => [
    [0, y],
    [length, y],
  ];
  const cuts: Cut[] = [];
  if (from != null && from > 0) cuts.push({ line: line(from), side: 1 });
  if (to != null && to < ceiling) cuts.push({ line: line(to), side: -1 });
  return cuts;
}

/** Partie d'un mur à couvrir, repère du mur (mm, y vers le haut) : null = jusqu'au bord (gauche, bas, droite, plafond). */
export interface WallArea {
  x0?: number | null;
  x1?: number | null;
  y0?: number | null;
  y1?: number | null;
}

/**
 * Coupes d'une zone qui ne couvre qu'une partie du mur : un rectangle (largeur et hauteur). Une ligne verticale orientée
 * vers le haut a son côté 1 à gauche (x plus petit) : `x0` garde la droite (côté −1), `x1` garde la gauche (côté 1).
 * Aucune coupe pour un bord que la zone atteint.
 */
export function wallAreaCuts(plan: Plan, s: SurfaceRef, area: WallArea): Cut[] {
  const rect = surfacePolygon(plan, s);
  if (!rect || s.wall == null) return [];
  const length = Math.max(...rect[0]!.map((p) => p[0]));
  const ceiling = Math.max(...rect[0]!.map((p) => p[1]));
  const cuts = wallSpanCuts(plan, s, area.y0 ?? null, area.y1 ?? null);
  const vertical = (x: number): Cut['line'] => [
    [x, 0],
    [x, ceiling],
  ];
  if (area.x0 != null && area.x0 > 0.5) cuts.push({ line: vertical(area.x0), side: -1 });
  if (area.x1 != null && area.x1 < length - 0.5) cuts.push({ line: vertical(area.x1), side: 1 });
  return cuts;
}

/** Boîte d'une zone dans le repère de sa surface [xmin, xmax, ymin, ymax] ; null si elle n'existe plus ou est vide. */
export function zoneBox(
  plan: Plan,
  z: Pick<Zone, 'surface' | 'cuts' | 'area' | 'holes'>,
): [number, number, number, number] | null {
  const pts = (zoneRegion(plan, z) ?? []).flat();
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}
