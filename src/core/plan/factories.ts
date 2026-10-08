/**
 * Pièces types (création rapide de l'éditeur de plan, migration v1 → v2). Contours en sens horaire à
 * l'écran, coin haut gauche en (0, 0). Les identifiants viennent de `newId` (le moteur reste déterministe).
 */
import type { Point, Polygon } from '../geometry/types';
import type { Id, Plan, PlanRoom } from './types';
import { DEFAULT_WALL_THICKNESS } from './walls';

/** Hauteur sous plafond par défaut, mm. */
export const DEFAULT_ROOM_HEIGHT = 2500;

export interface RoomOptions {
  name: string;
  height?: number;
  origin?: Point;
  thickness?: number;
}

export const emptyPlan = (): Plan => ({ rooms: [], passages: [] });

/** Pièce de contour quelconque, un mur par segment. */
export function roomFromOutline(outline: Polygon, opts: RoomOptions, newId: () => Id): PlanRoom {
  return {
    id: newId(),
    name: opts.name,
    outline,
    walls: outline.map(() => ({ id: newId(), thickness: opts.thickness ?? DEFAULT_WALL_THICKNESS })),
    obstacles: [],
    openings: [],
    height: opts.height ?? DEFAULT_ROOM_HEIGHT,
    origin: opts.origin ?? [0, 0],
  };
}

/** Rectangle longueur × largeur. */
export function rectRoom(length: number, width: number, opts: RoomOptions, newId: () => Id): PlanRoom {
  return roomFromOutline(
    [
      [0, 0],
      [length, 0],
      [length, width],
      [0, width],
    ],
    opts,
    newId,
  );
}

/** Forme en L : rectangle longueur × largeur dont on retire le coin bas droit (cutLength × cutWidth). */
export function lRoom(
  length: number,
  width: number,
  cutLength: number,
  cutWidth: number,
  opts: RoomOptions,
  newId: () => Id,
): PlanRoom {
  const x = length - cutLength,
    y = width - cutWidth;
  return roomFromOutline(
    [
      [0, 0],
      [length, 0],
      [length, y],
      [x, y],
      [x, width],
      [0, width],
    ],
    opts,
    newId,
  );
}

/** Forme en U : rectangle longueur × largeur, encoche au milieu du bas (ailes de largeur `arm`, profondeur `depth`). */
export function uRoom(
  length: number,
  width: number,
  arm: number,
  depth: number,
  opts: RoomOptions,
  newId: () => Id,
): PlanRoom {
  return roomFromOutline(
    [
      [0, 0],
      [length, 0],
      [length, width],
      [length - arm, width],
      [length - arm, width - depth],
      [arm, width - depth],
      [arm, width],
      [0, width],
    ],
    opts,
    newId,
  );
}
