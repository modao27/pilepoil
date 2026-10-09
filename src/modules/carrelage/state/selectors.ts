import type { Polygon, ProjectSpec, SurfaceSpec, TileSpec, ZoneSpec } from '../core';
import type { Id } from '../../../state/model';
import type { Corner, Edges, Opening, Plinth, Tile, Zone } from './model';
import type { CarrelageData, CarrelageProject } from './data';
import { roomJoints } from './surfaces';

/** Correspondance entre indices du moteur et identifiants du modèle. */
export interface SpecIds {
  surfaces: string[];
  zones: Id[][];
  openings: Id[][];
}

export interface ProjectSpecResult {
  spec: ProjectSpec;
  ids: SpecIds;
  /** Zones dont le carreau est introuvable dans la bibliothèque (calcul de leur surface impossible). */
  missingTiles: { surfaceId: string; zoneId: Id; tileId: Id }[];
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

/** Ce que le moteur lit d'une surface : surface résolue, ou surface d'un projet v1 (avec ses angles). */
export interface SurfaceSource {
  kind: 'wall' | 'floor';
  width: number;
  height: number;
  joint: number;
  split: 'h' | 'v';
  zones: Zone[];
  openings: Opening[];
  corners?: Corner[];
  plinth: Plinth | null;
  hiddenEdges: Edges;
  junctionsCovered: boolean;
  outline?: Polygon[] | null;
  outlineHidden?: boolean;
}

export function surfaceSpec(s: SurfaceSource, tiles: ReadonlyMap<Id, Tile>): SurfaceSpec {
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
    corners: (s.corners ?? []).map((c) => ({ x: c.x, type: c.type, angle: c.angle, covered: c.covered })),
    plinth: s.plinth
      ? { length: s.plinth.length, height: s.plinth.height, zone: Math.max(0, plinthZone) }
      : { length: 0, height: 80, zone: 0 },
    hiddenEdges: sides(s.hiddenEdges),
    junctionsCovered: s.junctionsCovered,
    ...(s.outline ? { outline: s.outline, outlineHidden: !!s.outlineHidden } : {}),
  };
}

/** Projet du modèle → entrée du moteur : surfaces résolues depuis le plan, carreaux de la bibliothèque. */
export function toProjectSpec(project: CarrelageProject, library: readonly Tile[]): ProjectSpecResult {
  const tiles = new Map(library.map((t) => [t.id, t]));
  const missingTiles: ProjectSpecResult['missingTiles'] = [];
  for (const s of project.surfaces) {
    for (const z of s.zones) {
      if (!tiles.has(z.tileId)) missingTiles.push({ surfaceId: s.id, zoneId: z.id, tileId: z.tileId });
    }
  }
  const { margin, reuseOffcuts, kerf, minOffcut } = project.settings;
  return {
    spec: {
      surfaces: project.surfaces.map((s) => surfaceSpec(s, tiles)),
      settings: { margin, reuseOffcuts, kerf, minOffcut },
      room: null,
      rooms: roomJoints(project.plan, project.rooms, project.surfaces),
    },
    ids: {
      surfaces: project.surfaces.map((s) => s.id),
      zones: project.surfaces.map((s) => s.zones.map((z) => z.id)),
      openings: project.surfaces.map((s) => s.openings.map((o) => o.id)),
    },
    missingTiles,
  };
}

/** Identifiants des carreaux utilisés par un projet, y compris par des réglages dont le mur a disparu du plan. */
export function usedTileIds(data: CarrelageData): Set<Id> {
  const tilings = Object.values(data.rooms).flatMap((r) => [...(r.floor ? [r.floor] : []), ...Object.values(r.walls)]);
  return new Set(tilings.flatMap((t) => t.zones.map((z) => z.tileId)));
}
