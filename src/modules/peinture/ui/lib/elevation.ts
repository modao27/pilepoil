/**
 * Élévation des murs d'une pose de peinture : chaque mur à plat, côte à côte, avec la partie peinte (zone) et ses
 * ouvertures. Repère : x le long du mur, y depuis le sol vers le haut, mm. Pur.
 */
import { zoneRegion } from '../../../../core/coverage/geometry';
import type { Zone } from '../../../../core/coverage/types';
import type { Polygon } from '../../../../core/geometry/types';
import { wallIndex, wallLength } from '../../../../core/plan/walls';
import { wallHeightOf } from '../../../../core/plan/levels';
import type { Id, Project } from '../../../../state/model';

export interface ElevOpening {
  kind: 'door' | 'french-window' | 'window';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElevWall {
  room: Id;
  wall: Id;
  /** « Cuisine, mur 2 ». */
  label: string;
  /** Position du mur dans l'élévation. */
  x0: number;
  length: number;
  height: number;
  /** Parties peintes (repère du mur). */
  painted: Polygon[];
  openings: ElevOpening[];
}

export interface Elevation {
  walls: ElevWall[];
  width: number;
  height: number;
}

/** Espace entre deux murs, mm. */
export const ELEVATION_GAP = 400;

export function elevationOf(project: Project, zones: readonly Zone[]): Elevation {
  const walls: ElevWall[] = [];
  let x = 0;
  for (const z of zones) {
    if (z.surface.wall == null) continue;
    const room = project.plan.rooms.find((r) => r.id === z.surface.room);
    const i = room ? wallIndex(room, z.surface.wall) : -1;
    if (!room || i < 0) continue;
    const painted = zoneRegion(project.plan, z) ?? [];
    const known = walls.find((w) => w.room === room.id && w.wall === z.surface.wall);
    if (known) {
      known.painted.push(...painted);
      continue;
    }
    const length = wallLength(room, i);
    walls.push({
      room: room.id,
      wall: z.surface.wall,
      label: `${room.name}, mur ${i + 1}`,
      x0: x,
      length,
      height: wallHeightOf(room, z.surface.wall),
      painted: [...painted],
      openings: room.openings
        .filter((o) => o.wall === z.surface.wall)
        .map((o) => ({ kind: o.kind, x: o.offset, y: o.sill, width: o.width, height: o.height })),
    });
    x += length + ELEVATION_GAP;
  }
  return {
    walls,
    width: Math.max(0, x - ELEVATION_GAP),
    height: walls.reduce((h, w) => Math.max(h, w.height), 0),
  };
}
