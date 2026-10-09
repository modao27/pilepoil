/**
 * Modèle persisté du carrelage : réglages de chaque pose (les zones qu'elle couvre sont dans le projet,
 * docs/NAVIGATION.md §4), carreaux, scénarios. La géométrie vient toujours du plan. Unités : mm, dates en ms.
 */
import type { Metrics, OptimizerGoal, Orientation, PatternId, Polygon } from '../core';
import type { SurfaceRef } from '../../../core/coverage/types';
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
  /** Angles sortants entre deux murs carrelés : profilé (sinon coupe apparente). */
  outerCornersCovered: boolean;
}

/** Bande de motif dans une pose (l'ancienne « zone » du carrelage). */
export interface Band {
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
  /** Bande dont on reprend le carreau. */
  bandId: Id;
}

/* ---------- réglages d'une pose ---------- */

/** Réglages d'une pose de carrelage (N1 : une pose couvre des zones d'une seule surface). */
export interface CarrelagePose {
  joint: number;
  split: 'h' | 'v';
  bands: Band[];
  /** Réservations propres au carrelage (prises, trappe, baignoire, autre), chacune sur une surface. */
  reservations: Reservation[];
  /** Finitions des portes et fenêtres du plan ; clé = id d'ouverture du plan. Absente : défauts. */
  openings: Record<Id, OpeningFinish>;
  /** Plinthe en carrelage (sols). */
  plinth: Plinth | null;
  /** Sol : coupes le long des murs cachées (plinthe) ; sinon apparentes. */
  edgesHidden: boolean;
  /** Mur : bords cachés de la zone (haut, bas, gauche, droite). */
  hiddenEdges: Edges;
  junctionsCovered: boolean;
}

/** Finition carrelage d'une porte ou fenêtre du plan. */
export interface OpeningFinish {
  covered: boolean;
  revealDepth: number;
  reveals: Edges;
}

export type ReservationType = 'socket' | 'trap' | 'tub' | 'other';

/**
 * Réservation : position sur sa surface — mur : x depuis le début du mur, sill depuis le sol ; sol : x et sill
 * depuis le bord gauche et le bord bas de la boîte englobante de la pièce.
 */
export interface Reservation extends Omit<Opening, 'type'> {
  type: ReservationType;
  surface: SurfaceRef;
}

export type { SurfaceRef };

/**
 * Surface d'une pose, résolue depuis ses zones : géométrie du plan + réglages de la pose. Calculée par la vue
 * (`carrelageView`), jamais enregistrée. Repère : boîte englobante des zones (y vers le bas). Ouvertures : portes
 * et fenêtres du plan (source 'plan', cotes du plan), puis réservations.
 */
export interface Surface {
  /** Identifiant de la pose : sert aux adresses et aux actions. */
  id: Id;
  ref: SurfaceRef;
  /** « Cuisine, sol » ; « Cuisine, sol · Pose 2 » si la surface a plusieurs poses de carrelage. */
  name: string;
  kind: 'wall' | 'floor';
  /** Boîte englobante des zones de la pose. */
  width: number;
  height: number;
  /** Contour des zones (contours et trous), repère de la surface ; null : le rectangle width × height. */
  outline: Polygon[] | null;
  /**
   * Coin de la boîte : sol, coin haut gauche dans le repère de la pièce ; mur, coin bas gauche dans le repère du
   * mur (x depuis le début du mur, y depuis le sol).
   */
  origin: [number, number];
  joint: number;
  split: 'h' | 'v';
  bands: Band[];
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

export const SCENARIO_SCHEMA = 4;

export interface Scenario {
  schemaVersion: typeof SCENARIO_SCHEMA;
  id: Id;
  projectId: Id;
  slot: 'A' | 'B';
  name: string;
  /** Projet entier figé ; au chargement, seuls les poses de carrelage, leurs zones et leurs réglages reviennent. */
  snapshot: { project: Project; tiles: Tile[] };
  metrics: Metrics | null;
  thumbnailId: Id | null;
  createdAt: number;
}
