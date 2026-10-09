/**
 * Modèle persisté du carrelage : réglages par élément du plan (sol, murs), carreaux, scénarios. La géométrie vient
 * toujours du plan commun (docs/PLAN.md C2). Unités : mm, dates en ms.
 */
import type { Metrics, OptimizerGoal, Orientation, PatternId, Polygon } from '../core';
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

export interface Plinth {
  length: number;
  height: number;
  zoneId: Id;
}

/* ---------- données carrelage (v2) ---------- */

/** Réglages du carrelage d'une pièce du plan. */
export interface RoomTiling {
  /** null : sol non carrelé. */
  floor: FloorTiling | null;
  /** Clé = identifiant de mur du plan. Mur absent : non carrelé. */
  walls: Record<Id, WallTiling>;
  /** Angles sortants entre deux murs carrelés : profilé (sinon coupe apparente). */
  outerCornersCovered: boolean;
}

/** Réglages propres au carrelage, communs au sol et aux murs. */
export interface TilingBase {
  joint: number;
  split: 'h' | 'v';
  zones: Zone[];
  /** Réservations propres au carrelage (prises, trappe, baignoire, autre), repère de la surface. */
  reservations: Reservation[];
  junctionsCovered: boolean;
}

export interface FloorTiling extends TilingBase {
  plinth: Plinth | null;
  /** Coupes le long des murs cachées (plinthe) ; sinon apparentes. */
  edgesHidden: boolean;
}

export interface WallTiling extends TilingBase {
  /** Hauteur carrelée depuis le sol ; null : jusqu'au plafond (hauteur de la pièce). */
  tiledHeight: number | null;
  hiddenEdges: Edges;
  /** Finitions des portes et fenêtres du plan sur ce mur ; clé = id d'ouverture du plan. Absente : défauts. */
  openings: Record<Id, OpeningFinish>;
}

/** Finition carrelage d'une porte ou fenêtre du plan. */
export interface OpeningFinish {
  covered: boolean;
  revealDepth: number;
  reveals: Edges;
}

export type ReservationType = 'socket' | 'trap' | 'tub' | 'other';

export interface Reservation extends Omit<Opening, 'type'> {
  type: ReservationType;
}

/** Sol ou mur d'une pièce du plan ; wall null : le sol. */
export interface SurfaceRef {
  room: Id;
  wall: Id | null;
}

/**
 * Surface résolue : géométrie du plan + réglages carrelage. Calculée par la vue (`carrelageView`), jamais
 * enregistrée. Ouvertures : portes et fenêtres du plan (source 'plan', cotes du plan), puis réservations.
 */
export interface Surface {
  /** `${roomId}~floor` ou `${roomId}~${wallId}` (`surfaceId`) : stable, sert aux adresses. */
  id: string;
  ref: SurfaceRef;
  /** « Cuisine, sol », « Cuisine, mur 2 ». */
  name: string;
  kind: 'wall' | 'floor';
  /** Mur : longueur × hauteur carrelée ; sol : boîte englobante du contour. */
  width: number;
  height: number;
  /** Sol : contour et obstacles (trous), repère de la surface ; mur : null (rectangle). */
  outline: Polygon[] | null;
  /** Position du coin haut gauche de la surface dans le repère de la pièce (sol). */
  origin: [number, number];
  joint: number;
  split: 'h' | 'v';
  zones: Zone[];
  openings: SurfaceOpening[];
  plinth: Plinth | null;
  hiddenEdges: Edges;
  junctionsCovered: boolean;
  /** Coupes le long du contour cachées. */
  outlineHidden: boolean;
}

export type SurfaceOpening = Opening & { source: 'plan' | 'tiling' };

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

export const SCENARIO_SCHEMA = 3;

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
