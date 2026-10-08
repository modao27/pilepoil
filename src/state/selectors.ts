import type { ProjectSpec, RoomSpec, SurfaceSpec, TileSpec, ZoneSpec } from '../core';
import type { Edges, Id, Project, Surface, Tile, Zone } from './model';

/** Correspondance entre indices du moteur et identifiants du modèle. */
export interface SpecIds {
  surfaces: Id[];
  zones: Id[][];
  openings: Id[][];
}

export interface ProjectSpecResult {
  spec: ProjectSpec;
  ids: SpecIds;
  /** Zones dont le carreau est introuvable dans la bibliothèque (calcul de leur surface impossible). */
  missingTiles: { surfaceId: Id; zoneId: Id; tileId: Id }[];
}

const sides = (e: Edges) => ({ L: e.left, R: e.right, T: e.top, B: e.bottom });

/** Carreau tel que posé à 0° : a horizontal, b vertical. */
export function tileSpec(tile: Tile, upright: boolean): TileSpec {
  const regular = tile.shape === 'hex' || tile.shape === 'octo';
  const a = regular ? tile.length : upright ? tile.width : tile.length,
    b = regular ? tile.length : upright ? tile.length : tile.width;
  return {
    width: a,
    height: b,
    thickness: tile.thickness,
    color: tile.color,
    m2PerBox: tile.m2PerBox,
    orientation: tile.orientation,
  };
}

/** Carreau absent : dimensions nulles, le moteur renvoie une erreur de carreau pour la surface. */
const MISSING: TileSpec = { width: 0, height: 0, thickness: 0, color: '#000000', m2PerBox: 0, orientation: 'free' };

function zoneSpec(z: Zone, tiles: ReadonlyMap<Id, Tile>): ZoneSpec {
  const t = tiles.get(z.tileId);
  return {
    size: z.size,
    unit: z.unit,
    pattern: z.pattern,
    tile: t ? tileSpec(t, z.tileUpright) : MISSING,
    angle: z.angle,
    start: z.start,
    offsetX: z.offsetX,
    offsetY: z.offsetY,
    mix: z.mix,
    colorB: z.colorB,
    groutColor: z.groutColor,
  };
}

export function surfaceSpec(s: Surface, tiles: ReadonlyMap<Id, Tile>): SurfaceSpec {
  const plinthZone = s.plinth ? s.zones.findIndex((z) => z.id === s.plinth!.zoneId) : -1;
  return {
    kind: s.kind,
    width: s.width,
    height: s.height,
    joint: s.joint,
    split: s.split,
    zones: s.zones.map((z) => zoneSpec(z, tiles)),
    openings: s.openings.map((o) => ({
      type: o.type,
      x: o.x,
      sill: o.sill,
      width: o.width,
      height: o.height,
      covered: o.covered,
      revealDepth: o.revealDepth,
      reveals: sides(o.reveals),
      projection: o.projection,
    })),
    corners: s.corners.map((c) => ({ x: c.x, type: c.type, angle: c.angle, covered: c.covered })),
    plinth: s.plinth
      ? { length: s.plinth.length, height: s.plinth.height, zone: Math.max(0, plinthZone) }
      : { length: 0, height: 80, zone: 0 },
    hiddenEdges: sides(s.hiddenEdges),
    junctionsCovered: s.junctionsCovered,
  };
}

/** Projet du modèle → entrée du moteur, carreaux résolus dans la bibliothèque. */
export function toProjectSpec(project: Project, library: readonly Tile[]): ProjectSpecResult {
  const tiles = new Map(library.map((t) => [t.id, t]));
  const index = new Map(project.surfaces.map((s, i) => [s.id, i]));
  const missingTiles: ProjectSpecResult['missingTiles'] = [];
  for (const s of project.surfaces) {
    for (const z of s.zones) {
      if (!tiles.has(z.tileId)) missingTiles.push({ surfaceId: s.id, zoneId: z.id, tileId: z.tileId });
    }
  }
  let room: RoomSpec | null = null;
  if (project.room) {
    const walls: RoomSpec['walls'] = {};
    for (const [k, id] of Object.entries(project.room.walls)) {
      const i = id != null ? index.get(id) : undefined;
      if (i != null) walls[k as keyof RoomSpec['walls']] = i;
    }
    room = { length: project.room.length, width: project.room.width, walls };
  }
  const { margin, reuseOffcuts, kerf, minOffcut } = project.settings;
  return {
    spec: {
      surfaces: project.surfaces.map((s) => surfaceSpec(s, tiles)),
      settings: { margin, reuseOffcuts, kerf, minOffcut },
      room,
    },
    ids: {
      surfaces: project.surfaces.map((s) => s.id),
      zones: project.surfaces.map((s) => s.zones.map((z) => z.id)),
      openings: project.surfaces.map((s) => s.openings.map((o) => o.id)),
    },
    missingTiles,
  };
}

/** Identifiants des carreaux utilisés par un projet. */
export function usedTileIds(project: Project): Set<Id> {
  return new Set(project.surfaces.flatMap((s) => s.zones.map((z) => z.tileId)));
}
