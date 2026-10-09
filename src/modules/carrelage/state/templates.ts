/**
 * Projets créés par l'assistant : une pièce rectangulaire dans le plan, dont on carrèle un mur, le sol, ou
 * plusieurs murs et le sol (murs A à D = murs 1 à 4 du contour, A en haut, sens horaire).
 */
import type { PatternId } from '../core';
import { rectRoom } from '../../../core/plan/factories';
import { PROJECT_SCHEMA, type Id, type Project } from '../../../state/model';
import { createData, createFloorTiling, createRoomTiling, createWallTiling, createZone, newId } from './factories';
import type { RoomWallKey, WallTiling } from './model';
import { CARRELAGE_ID, CARRELAGE_SCHEMA } from './data';

export interface LayoutChoice {
  tileId: Id;
  tileUpright: boolean;
  pattern: PatternId;
  angle: number;
  joint: number;
}

export interface SingleSurfaceInput extends LayoutChoice {
  kind: 'wall' | 'floor';
  width: number;
  height: number;
  name?: string;
}

export interface RoomInput extends LayoutChoice {
  length: number;
  width: number;
  height: number;
  tiledHeight: number;
  walls: Record<RoomWallKey, boolean>;
  name?: string;
}

const cm = (mm: number) => Math.round(mm / 10);

const WALLS = ['A', 'B', 'C', 'D'] as const;

function base(c: LayoutChoice) {
  return {
    joint: c.joint,
    zones: [createZone(c.tileId, { tileUpright: c.tileUpright, pattern: c.pattern, angle: c.angle })],
  };
}

function projectWith(
  name: string,
  room: ReturnType<typeof rectRoom>,
  tiling: ReturnType<typeof createRoomTiling>,
  now: number,
): Project {
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    plan: { rooms: [room], passages: [] },
    modules: {
      [CARRELAGE_ID]: { schemaVersion: CARRELAGE_SCHEMA, data: createData({ rooms: { [room.id]: tiling } }) },
    },
  };
}

/**
 * Mur seul : pièce de largeur × 2 m, hauteur sous plafond = hauteur du mur, premier mur carrelé.
 * Sol seul : pièce largeur × hauteur, sol carrelé.
 */
export function createSingleSurfaceProject(i: SingleSurfaceInput, now = Date.now()): Project {
  const label = i.kind === 'floor' ? 'Sol' : 'Mur';
  const name = i.name?.trim() || `${label} ${cm(i.width)} × ${cm(i.height)}`;
  if (i.kind === 'floor') {
    const room = rectRoom(i.width, i.height, { name: 'Pièce' }, newId);
    return projectWith(name, room, createRoomTiling({ floor: createFloorTiling(i.tileId, base(i)) }), now);
  }
  const room = rectRoom(i.width, 2000, { name: 'Pièce', height: i.height }, newId);
  const wall: WallTiling = createWallTiling(i.tileId, base(i));
  return projectWith(name, room, createRoomTiling({ walls: { [room.walls[0]!.id]: wall } }), now);
}

/** Murs A et C sur la longueur, B et D sur la largeur, carrelés sur tiledHeight ; sol longueur × largeur. */
export function createRoomProject(i: RoomInput, now = Date.now()): Project {
  const room = rectRoom(i.length, i.width, { name: 'Pièce', height: i.height }, newId);
  const walls: Record<Id, WallTiling> = {};
  WALLS.forEach((k, n) => {
    if (i.walls[k])
      walls[room.walls[n]!.id] = createWallTiling(i.tileId, {
        ...base(i),
        tiledHeight: i.tiledHeight >= i.height ? null : i.tiledHeight,
      });
  });
  const floor = i.walls.floor ? createFloorTiling(i.tileId, base(i)) : null;
  const name = i.name?.trim() || `Pièce ${cm(i.length)} × ${cm(i.width)}`;
  return projectWith(name, room, createRoomTiling({ floor, walls }), now);
}
