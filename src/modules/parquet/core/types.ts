/**
 * Entrée et sortie du moteur du parquet (docs/parquet/SPEC.md §2–§3). Unités : mm, degrés.
 * Pur et sérialisable en JSON (passage par le worker). Coordonnées dans le repère du plan d'ensemble.
 */
import type { Point, Polygon, Segment } from '../../../core/geometry/types';
import type { Board } from './board';

type Id = string;

/* ---------- réglages partagés par les données et l'entrée du moteur ---------- */

export type Pattern =
  /** Coupe perdue (« à l'anglaise ») : le décalage découle des chutes. */
  | { kind: 'random-stagger' }
  /** Décalage régulier : fraction de lame (1/2, 1/3, 1/4 ou libre, 0 < step < 1). */
  | { kind: 'regular-stagger'; step: number }
  /** Bâton rompu (P2). */
  | { kind: 'herringbone' }
  /** Point de Hongrie (P2). */
  | { kind: 'chevron'; endAngle: 45 | 60 };

export type LayingMethod = 'floating' | 'glued' | 'nailed';

export interface LayingRules {
  /** Jeu périphérique et autour des obstacles. */
  expansionGap: number;
  /** Coupe mini en bout de rang. */
  minCutLength: number;
  /** Décalage mini entre joints de rangs voisins. */
  minJointOffset: number;
  /** Largeur mini du premier et du dernier rang. */
  minEdgeRowWidth: number;
  balanceEdgeRows: 'if-needed' | 'always';
  /** Au-delà, alerte de fractionnement (pose flottante) ; null : sans objet. */
  maxFloatingLength: number | null;
  maxFloatingWidth: number | null;
  /** Passage plus étroit : seuil conseillé (pose flottante) ; null : sans objet. */
  minPassageWidth: number | null;
}

export interface ParquetSettings {
  reuseOffcuts: boolean;
  /** Perte par coupe (lame de scie). */
  kerf: number;
  /** Marge d'achat en % ; null = valeur conseillée du motif (5 / 10 / 12 %). */
  marginPct: number | null;
}

export interface Accessories {
  /** overlap : recouvrement en fraction de la surface (0,05 = 5 %). */
  underlay: { enabled: boolean; m2PerRoll: number; overlap: number };
  /** upstand : remontée périphérique, mm. */
  vaporBarrier: { enabled: boolean; m2PerRoll: number; overlap: number; upstand: number };
  skirting: { enabled: boolean; barLength: number; height: number; mitreAllowance: number };
  thresholds: { barLength: number };
  /** Pose collée : m² par seau ou cartouche. */
  glue: { m2PerUnit: number } | null;
  /** Pose clouée : fixations par m². */
  fixings: { perM2: number } | null;
}

/* ---------- entrée du moteur ---------- */

/** Ce que le moteur lit d'une lame de la bibliothèque. */
export type BoardSpec = Pick<
  Board,
  'id' | 'lengths' | 'lengthMix' | 'width' | 'thickness' | 'handed' | 'boardsPerPack'
>;

/** Ouverture au sol (porte, baie) : interrompt les plinthes (P4). */
export interface WallOpeningSpec {
  segment: Segment;
  kind: 'door' | 'french-window' | 'window';
}

export interface ParquetSpec {
  /** Une par pose, pièces résolues depuis le plan. */
  layouts: LayoutSpec[];
  /** marginPct résolu par toSpec (jamais null ici). */
  settings: Omit<ParquetSettings, 'marginPct'> & { marginPct: number };
  accessories: Accessories;
}

/**
 * Passage entre deux pièces : `segment` = ouverture côté pièce `a` (repère du plan), `depth` = épaisseur du mur.
 * La bande `segment × depth` relie les surfaces des deux pièces.
 */
export interface PassageSpec {
  id: Id;
  a: Id;
  b: Id;
  segment: Segment;
  width: number;
  depth: number;
}

/** Demi-plan : côté 1 = à gauche de la ligne orientée de line[0] vers line[1] (produit vectoriel > 0). */
export interface ZoneBound {
  line: Segment;
  side: 1 | -1;
}

export interface Threshold {
  /** Repère du plan, d'un bord posable à l'autre. */
  segment: Segment;
  /** Passage coupé, s'il y en a un. */
  passage: Id | null;
  /** proposed : conseillé par le moteur ; applied : posé (breaks ou limite de zone). */
  status: 'proposed' | 'applied';
  /** Seuils proposés : pourquoi. */
  reason?: 'narrow-passage' | 'fractioning';
}

export interface LayoutSpec {
  id: Id;
  rooms: { id: Id; outline: Polygon; obstacles: Polygon[]; openings: WallOpeningSpec[] }[];
  /** Passages entre deux pièces de la pose (P3). */
  passages: PassageSpec[];
  /** null : lame introuvable dans la bibliothèque (erreur `missing-board`). */
  board: BoardSpec | null;
  pattern: Pattern;
  /** Degrés, sens horaire à l'écran ; 0 = lames parallèles au mur de référence. */
  angle: number;
  /** Vecteur unitaire du mur de référence. */
  referenceDirection: Point;
  /** Axe des motifs : point du plan, ou une des trois propositions résolue par le moteur (SPEC §4.3). */
  axis: Point | AxisKind;
  /** Décalage manuel de l'origine du motif. */
  offset: Point;
  method: LayingMethod;
  rules: LayingRules;
  /** Seuils (fractionnement), segments du plan. */
  breaks: Segment[];
  /** Zone de la pose : demi-plans qui la limitent dans ses pièces (poses séparées). Vide : pièces entières. */
  zone: ZoneBound[];
  /** Graine des tirages (coupe perdue, longueurs mixtes). */
  seed: number;
}

/* ---------- sortie du moteur ---------- */

export interface ParquetResult {
  layouts: LayoutResult[];
  skirting: SkirtingResult;
  totals: { area: number; boards: number; boardsA: number; boardsB: number; wastePct: number; cuts: number };
  /** Empreinte de l'entrée (suivi chantier). */
  hash: string;
}

export interface LayoutResult {
  id: Id;
  /** Surface posable (pièces − jeux − obstacles), repère du plan, règle non nulle. */
  layable: Polygon[];
  pieces: LaidPiece[];
  /** Lames neuves et ce qu'on y taille. */
  boards: BoardUse[];
  /** Chutes restantes en fin de calcul. */
  offcuts: Offcut[];
  /** Seuils proposés ou posés (P3). */
  thresholds: Threshold[];
  warnings: ParquetWarning[];
  errors: ParquetError[];
  /** Motifs : trois placements d'axe proposés, avec la plus petite coupe en bord de chacun. */
  axisOptions?: AxisOption[];
}

export type AxisKind = 'room-center' | 'main-door' | 'reference-wall';

/** Pose dont l'axe est résolu en point. */
export type PlacedLayout = LayoutSpec & { axis: Point };

export interface AxisOption {
  kind: AxisKind;
  point: Point;
  /** Plus petite largeur de coupe en bord, mm. */
  minCutWidth: number;
}

export interface LaidPiece {
  /** Stable pour une même entrée : 'L1-R03-P02'. */
  id: string;
  room: Id;
  /** Pose droite : rang (0 = premier rang posé). */
  row: number | null;
  /** Motifs : rang le long de l'axe (P2). */
  line: number | null;
  /** Repère du plan. */
  polygon: Polygon;
  variant: 'A' | 'B' | null;
  /** Longueur utile de la pièce, repère lame. */
  length: number;
  cutType: 'full' | 'straight' | 'angled' | 'complex';
  /** Coupes dans le repère lame (origine bout gauche, x le long de la lame). */
  cuts: Segment[];
  source: { board: number } | { offcut: string };
  /** Coupée en largeur (rang de bord, contournement). */
  ripped: boolean;
}

/** Lame neuve : sa longueur (longueurs mixtes) et les pièces qu'on y taille, dans l'ordre. */
export interface BoardUse {
  index: number;
  variant: 'A' | 'B' | null;
  length: number;
  pieces: string[];
}

/** Chute de lame : 1D en pose droite (longueur), polygone dans le repère lame pour les motifs (P2). */
export interface Offcut {
  id: string;
  /** Lame d'origine. */
  board: number;
  variant: 'A' | 'B' | null;
  length: number;
  polygon: Polygon | null;
}

/** Plinthes (P4) : barres et coupes par mur. */
export interface SkirtingResult {
  bars: number;
  cuts: { room: Id; wall: number; lengths: number[] }[];
  offcuts: number[];
}

export type ParquetWarning =
  | { code: 'edge-row-narrow'; room: Id; width: number }
  | { code: 'cut-too-short'; piece: string; length: number }
  | { code: 'joint-offset'; row: number; offset: number }
  | { code: 'fractioning-needed'; length: number; width: number }
  | { code: 'narrow-passage'; passage: string; width: number }
  | { code: 'tiny-piece'; piece: string; area: number }
  /** La surface de cette pose recouvre celle d'une pose précédente. */
  | { code: 'layout-overlap'; layout: Id };

export type ParquetError =
  | { code: 'invalid-room'; room: Id }
  | { code: 'missing-board' }
  /** minCutLength + minJointOffset > longueur de lame. */
  | { code: 'board-too-short-for-rules' }
  | { code: 'too-many-pieces'; estimate: number };
