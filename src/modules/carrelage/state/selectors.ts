import type { ProjectSpec, SurfaceSpec, TileSpec, ZoneSpec } from '../core';
import type { Id } from '../../../state/model';
import type { Band, Edges, Surface, Tile } from './model';
import type { CarrelageData, CarrelageProject } from './data';
import { roomJoints } from './surfaces';

/** Correspondance entre indices du moteur et identifiants du modèle. */
export interface SpecIds {
  surfaces: string[];
  bands: Id[][];
  openings: Id[][];
}

export interface ProjectSpecResult {
  spec: ProjectSpec;
  ids: SpecIds;
  /** Zones dont le carreau est introuvable dans la bibliothèque (calcul de leur surface impossible). */
  missingTiles: { surfaceId: string; bandId: Id; tileId: Id }[];
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

/** Bande → zone du moteur (le moteur garde le nom de legacy). */
function zoneSpec(z: Band, tiles: ReadonlyMap<Id, Tile>): ZoneSpec {
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

export function surfaceSpec(s: Surface, tiles: ReadonlyMap<Id, Tile>, outerCovered = true): SurfaceSpec {
  const plinthZone = s.plinth ? s.bands.findIndex((z) => z.id === s.plinth!.bandId) : -1;
  return {
    kind: s.kind,
    width: s.width,
    height: s.height,
    joint: s.joint,
    split: s.split,
    zones: s.bands.map((z) => zoneSpec(z, tiles)),
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
    corners: s.corners.map((c) => ({ ...c, covered: outerCovered && c.type === 'out' })),
    plinth: s.plinth
      ? { length: s.plinth.length, height: s.plinth.height, zone: Math.max(0, plinthZone) }
      : { length: 0, height: 80, zone: 0 },
    hiddenEdges: sides(s.hiddenEdges),
    junctionsCovered: s.junctionsCovered,
    ...(s.outline ? { outline: s.outline, outlineHidden: s.outlineHidden } : {}),
  };
}

/** Projet du modèle → entrée du moteur : surfaces résolues depuis le plan, carreaux de la bibliothèque. */
export function toProjectSpec(project: CarrelageProject, library: readonly Tile[]): ProjectSpecResult {
  const tiles = new Map(library.map((t) => [t.id, t]));
  const missingTiles: ProjectSpecResult['missingTiles'] = [];
  for (const s of project.surfaces) {
    for (const z of s.bands) {
      if (!tiles.has(z.tileId)) missingTiles.push({ surfaceId: s.id, bandId: z.id, tileId: z.tileId });
    }
  }
  const { margin, reuseOffcuts, kerf, minOffcut } = project.settings;
  return {
    spec: {
      surfaces: project.surfaces.map((s) => surfaceSpec(s, tiles, project.settings.outerCornersCovered)),
      settings: { margin, reuseOffcuts, kerf, minOffcut },
      room: null,
      rooms: roomJoints(project.plan, project.surfaces, project.settings.outerCornersCovered),
    },
    ids: {
      surfaces: project.surfaces.map((s) => s.id),
      bands: project.surfaces.map((s) => s.bands.map((z) => z.id)),
      openings: project.surfaces.map((s) => s.openings.map((o) => o.id)),
    },
    missingTiles,
  };
}

/** Identifiants des carreaux utilisés par un projet (toutes ses poses de carrelage). */
export function usedTileIds(data: CarrelageData): Set<Id> {
  return new Set(Object.values(data.poses).flatMap((t) => t.bands.map((z) => z.tileId)));
}
