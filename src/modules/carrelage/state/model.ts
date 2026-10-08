/** Modèle persisté du carrelage (docs/MODEL.md) : surfaces, carreaux, scénarios. Unités : mm, dates en ms. */
import type { Metrics, OptimizerGoal, Orientation, PatternId } from '../core';
import type { Id, Project } from '../../../state/model';

export interface Edges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface ProjectSettings {
  /** % */
  margin: number;
  reuseOffcuts: boolean;
  kerf: number;
  minOffcut: number;
  /** Variation de nuance du rendu, 0 à 1. */
  shadeVariation: number;
  optimizerGoal: OptimizerGoal;
}

export type RoomWallKey = 'A' | 'B' | 'C' | 'D' | 'floor';

export interface Room {
  length: number;
  width: number;
  height: number;
  tiledHeight: number;
  /** Surface de chaque mur et du sol. */
  walls: Partial<Record<RoomWallKey, Id>>;
}

export interface Zone {
  id: Id;
  /** Rangées, ou mm si unit = 'length'. */
  size: number;
  unit: 'rows' | 'length' | 'rest';
  tileId: Id;
  /** Carreau debout : long côté vertical à 0°. */
  tileUpright: boolean;
  pattern: PatternId;
  angle: number;
  start: 'corner' | 'tile' | 'joint';
  offsetX: number;
  offsetY: number;
  mix: 'solid' | 'alternate' | 'random';
  colorB: string;
  groutColor: string;
  photoRandomFlip: boolean;
}

export type OpeningType = 'window' | 'door' | 'socket' | 'trap' | 'tub' | 'other';

export interface Opening {
  id: Id;
  type: OpeningType;
  x: number;
  sill: number;
  width: number;
  height: number;
  covered: boolean;
  revealDepth: number;
  reveals: Edges;
  projection: number;
}

export interface Corner {
  id: Id;
  x: number;
  type: 'in' | 'out';
  angle: number;
  covered: boolean;
}

export interface Plinth {
  length: number;
  height: number;
  zoneId: Id;
}

export interface Surface {
  id: Id;
  name: string;
  kind: 'wall' | 'floor';
  width: number;
  height: number;
  joint: number;
  split: 'h' | 'v';
  zones: Zone[];
  openings: Opening[];
  corners: Corner[];
  plinth: Plinth | null;
  hiddenEdges: Edges;
  junctionsCovered: boolean;
}

/** Projet v1 (avant la boîte à outils) : le carrelage seul. Produit par la conversion legacy. */
export interface CarrelageProjectV1 {
  schemaVersion: 1;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  surfaces: Surface[];
  room: Room | null;
  settings: ProjectSettings;
  /** Prix unitaires par clé d'article de la liste d'achat. */
  prices: Record<string, number>;
}

export type TileShape = 'rect' | 'hex' | 'octo' | 'chevron';

export const TILE_SCHEMA = 1;

export interface Tile {
  schemaVersion: typeof TILE_SCHEMA;
  id: Id;
  name: string;
  shape: TileShape;
  /** Long côté ; hexagone et octogone : largeur plat à plat. */
  length: number;
  /** Court côté ; hexagone et octogone : égal à length. */
  width: number;
  thickness: number;
  color: string;
  photoId: Id | null;
  /** 0 = vendu à la pièce. */
  m2PerBox: number;
  pricePerM2: number | null;
  orientation: Orientation;
  createdAt: number;
  updatedAt: number;
}

export const SCENARIO_SCHEMA = 2;

export interface Scenario {
  schemaVersion: typeof SCENARIO_SCHEMA;
  id: Id;
  projectId: Id;
  slot: 'A' | 'B';
  name: string;
  /** Projet entier figé (v2) ; seules les données carrelage sont rétablies au chargement. */
  snapshot: { project: Project; tiles: Tile[] };
  metrics: Metrics | null;
  thumbnailId: Id | null;
  createdAt: number;
}

/** Scénario v1 : instantané d'un projet v1 (conversion legacy, migration). */
export type ScenarioV1 = Omit<Scenario, 'schemaVersion' | 'snapshot'> & {
  schemaVersion: 1;
  snapshot: { project: CarrelageProjectV1; tiles: Tile[] };
};
