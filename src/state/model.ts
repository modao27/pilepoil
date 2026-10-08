/** Modèle persisté (voir docs/MODEL.md). Unités : mm, dates en ms. */
import type { Metrics, OptimizerGoal, Orientation, PatternId } from '../core';
import type { Plan } from '../core/plan/types';

export type Id = string;

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

export const PROJECT_SCHEMA = 1;

export interface Project {
  schemaVersion: typeof PROJECT_SCHEMA;
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

/**
 * Projet v2 (docs/BOITE.md §4) : plan commun + données de chaque module activé.
 * Défini en S1 pour le contrat des modules ; la migration v1 → v2 arrive en S2.
 */
export interface ProjectV2 {
  schemaVersion: 2;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
  /** Données de chaque module activé, avec leur propre version ; clé = identifiant du module. */
  modules: Record<string, ModuleDoc>;
}

/** Chaque module type et valide ses propres `data`. */
export interface ModuleDoc {
  schemaVersion: number;
  data: unknown;
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

export interface Photo {
  id: Id;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export const SCENARIO_SCHEMA = 1;

export interface Scenario {
  schemaVersion: typeof SCENARIO_SCHEMA;
  id: Id;
  projectId: Id;
  slot: 'A' | 'B';
  name: string;
  snapshot: { project: Project; tiles: Tile[] };
  metrics: Metrics | null;
  thumbnailId: Id | null;
  createdAt: number;
}

export interface Palette {
  tiles: string[];
  grouts: string[];
}

export type Pref =
  | { key: 'palette'; value: Palette }
  | { key: 'theme'; value: 'auto' | 'light' | 'dark' }
  | { key: 'lastProjectId'; value: Id }
  | { key: 'showCutNumbers'; value: boolean }
  | { key: 'legacyImport'; value: { at: number; projectId: Id | null } };

export type PrefKey = Pref['key'];
export type PrefValue<K extends PrefKey> = Extract<Pref, { key: K }>['value'];
