/** Projets créés par l'assistant : mur ou sol seul, ou pièce complète (murs A à D + sol, comme legacy). */
import type { PatternId } from '../core';
import { createProject, createSurface, createZone, newId } from './factories';
import type { Id, Project, RoomWallKey, Surface } from '../../../state/model';

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

function surfaceWith(c: LayoutChoice, o: Partial<Surface>): Surface {
  return createSurface(c.tileId, {
    joint: c.joint,
    zones: [createZone(c.tileId, { tileUpright: c.tileUpright, pattern: c.pattern, angle: c.angle })],
    ...o,
  });
}

export function createSingleSurfaceProject(i: SingleSurfaceInput, now = Date.now()): Project {
  const label = i.kind === 'floor' ? 'Sol' : 'Mur';
  const s = surfaceWith(i, { name: label, kind: i.kind, width: i.width, height: i.height });
  return createProject([s], { name: i.name?.trim() || `${label} ${cm(i.width)} × ${cm(i.height)}` }, now);
}

const WALL_NAMES: Record<RoomWallKey, string> = { A: 'Mur A', B: 'Mur B', C: 'Mur C', D: 'Mur D', floor: 'Sol' };

export interface RoomUpdate {
  length: number;
  width: number;
  height: number;
  tiledHeight: number;
  walls: Record<RoomWallKey, boolean>;
}

/**
 * Crée ou met à jour la pièce d'un projet [roomGo] : chaque mur ou sol demandé reçoit une surface (copie de
 * `template` sans ouvertures, angles ni plinthe ; la première surface est reprise si elle est seule et hors
 * pièce), puis toutes prennent les dimensions de la pièce. Les surfaces décochées restent, hors pièce.
 */
export function applyRoom(project: Project, template: Surface, i: RoomUpdate): Project {
  let walls: Partial<Record<RoomWallKey, Id>> = { ...(project.room?.walls ?? {}) };
  let surfaces = project.surfaces.slice();
  const inRoom = new Set(Object.values(walls));
  for (const k of ['A', 'B', 'C', 'D', 'floor'] as const) {
    if (!i.walls[k]) {
      walls = Object.fromEntries(Object.entries(walls).filter(([key]) => key !== k));
      continue;
    }
    let s = surfaces.find((x) => x.id === walls[k]);
    if (!s) {
      const reuseFirst = surfaces.length === 1 && !project.room && !inRoom.has(surfaces[0]!.id);
      if (reuseFirst) s = surfaces[0]!;
      else {
        const copy = structuredClone(template);
        s = {
          ...copy,
          id: newId(),
          openings: [],
          corners: [],
          plinth: null,
          zones: copy.zones.map((z) => ({ ...z, id: newId() })),
        };
        surfaces.push(s);
      }
      const floor = k === 'floor';
      s = {
        ...s,
        name: WALL_NAMES[k],
        kind: floor ? 'floor' : 'wall',
        ...(floor
          ? {
              zones: [{ ...s.zones[0]!, unit: 'rest' as const }],
              openings: s.openings.filter((o) => o.type === 'tub' || o.type === 'trap'),
              plinth: null,
            }
          : {}),
      };
      walls[k] = s.id;
      inRoom.add(s.id);
    }
    const floor = k === 'floor';
    const sized: Surface = {
      ...s,
      width: floor || k === 'A' || k === 'C' ? i.length : i.width,
      height: floor ? i.width : Math.min(i.tiledHeight, i.height),
    };
    surfaces = surfaces.some((x) => x.id === sized.id)
      ? surfaces.map((x) => (x.id === sized.id ? sized : x))
      : [...surfaces, sized];
  }
  const room = Object.keys(walls).length
    ? { length: i.length, width: i.width, height: i.height, tiledHeight: i.tiledHeight, walls }
    : null;
  return { ...project, surfaces, room };
}

/** Murs A et C sur la longueur, B et D sur la largeur, carrelés sur tiledHeight ; sol longueur × largeur. */
export function createRoomProject(i: RoomInput, now = Date.now()): Project {
  const keys = (['A', 'B', 'C', 'D', 'floor'] as const).filter((k) => i.walls[k]);
  const walls: Partial<Record<RoomWallKey, Id>> = {};
  const surfaces = keys.map((k) => {
    const floor = k === 'floor';
    const s = surfaceWith(i, {
      name: WALL_NAMES[k],
      kind: floor ? 'floor' : 'wall',
      width: floor || k === 'A' || k === 'C' ? i.length : i.width,
      height: floor ? i.width : Math.min(i.tiledHeight, i.height),
    });
    walls[k] = s.id;
    return s;
  });
  return createProject(
    surfaces,
    {
      name: i.name?.trim() || `Pièce ${cm(i.length)} × ${cm(i.width)}`,
      room: { length: i.length, width: i.width, height: i.height, tiledHeight: i.tiledHeight, walls },
    },
    now,
  );
}
