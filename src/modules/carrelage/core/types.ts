/**
 * Types d'entrée et de sortie du moteur. Tout est en millimètres et sérialisable en JSON
 * (passage par le worker). Les noms legacy sont rappelés entre crochets.
 */

import type { Point, Polygon, Segment } from '../../../core/geometry/types';

export type { BBox, Point, Polygon, Segment } from '../../../core/geometry/types';

export type Side = 'L' | 'R' | 'T' | 'B';
export type SideFlags = Record<Side, boolean>;

export type PatternId =
  'grid' | 'half' | 'third' | 'quarter' | 'rand' | 'herring' | 'chevron' | 'basket' | 'hex' | 'octo';
/** Forme du produit commandé ; « cab » = cabochon de l'octogone. */
export type TileShape = 'rect' | 'hex' | 'octo' | 'chevron' | 'cab';
export type ZoneStart = 'corner' | 'tile' | 'joint';
/** rows : nombre de rangées ; length : longueur en mm [legacy 'cm', en cm] ; rest : reste de la surface. */
export type ZoneUnit = 'rows' | 'length' | 'rest';
/** [legacy 'uni' | 'alt' | 'rand'] */
export type ColorMix = 'solid' | 'alternate' | 'random';
/** Rotations permises au réemploi : libre, demi-tour seulement, aucune. */
export type Orientation = 'free' | '180' | 'none';
export type OptimizerGoal = 'thin' | 'tiles' | 'bal' | 'sym';

export interface TileSpec {
  /** Côté horizontal à 0° [a]. */
  width: number;
  /** Côté vertical à 0° [b]. */
  height: number;
  /** Épaisseur [th] ; 0 = inconnue (9 mm pour le joint). */
  thickness: number;
  /** Couleur principale [c1]. */
  color: string;
  /** m² par carton [box] ; 0 = vendu à la pièce. */
  m2PerBox: number;
  /** Rotations permises au réemploi des chutes [orient, réglage global dans legacy]. */
  orientation: Orientation;
}

export interface ZoneSpec {
  /** Rangées (unit rows) ou mm (unit length) [size, en cm pour legacy]. */
  size: number;
  unit: ZoneUnit;
  pattern: PatternId;
  tile: TileSpec;
  /** Degrés : 0, 30, 45, 60 ou 90. */
  angle: number;
  start: ZoneStart;
  /** [dx] */
  offsetX: number;
  /** [dy] */
  offsetY: number;
  mix: ColorMix;
  /** Seconde couleur [c2]. */
  colorB: string;
  /** [grout] */
  groutColor: string;
}

export type OpeningType = 'window' | 'door' | 'socket' | 'trap' | 'tub' | 'other';

export interface OpeningSpec {
  type: OpeningType;
  /** Bord gauche depuis la gauche de la surface. */
  x: number;
  /** Allège : hauteur du bas de l'ouverture depuis le bas de la surface. */
  sill: number;
  /** [w] */
  width: number;
  /** [h] */
  height: number;
  /** Arêtes protégées par un profilé [cov]. */
  covered: boolean;
  /** Profondeur des tableaux en mm [depth, en cm pour legacy]. */
  revealDepth: number;
  /** Côtés carrelés en tableau [rv]. */
  reveals: SideFlags;
  /** Avancée d'une baignoire [proj]. */
  projection: number;
}

/** Angle de mur [fold]. */
export interface CornerSpec {
  x: number;
  type: 'in' | 'out';
  /** [ang] */
  angle: number;
  /** Profilé sur angle sortant [cov]. */
  covered: boolean;
}

export interface PlinthSpec {
  /** 0 = pas de plinthes [len]. */
  length: number;
  /** [h] */
  height: number;
  /** Indice de la zone dont on reprend le carreau. */
  zone: number;
}

export interface SurfaceSpec {
  kind: 'wall' | 'floor';
  /** [W] */
  width: number;
  /** [H] */
  height: number;
  /** [j] */
  joint: number;
  split: 'h' | 'v';
  zones: ZoneSpec[];
  /** [res] */
  openings: OpeningSpec[];
  /** [folds] */
  corners: CornerSpec[];
  plinth: PlinthSpec;
  /** [hid] */
  hiddenEdges: SideFlags;
  /** [jcov] */
  junctionsCovered: boolean;
  /**
   * Contour réel de la surface (région du plan : contours d'aire > 0, trous d'aire < 0, repère surface, y vers
   * le bas), dans le rectangle width × height. Absent : la surface est ce rectangle (calcul historique).
   */
  outline?: Polygon[];
  /** Coupes le long du contour cachées (plinthe, profilé) ; sinon apparentes. */
  outlineHidden?: boolean;
}

export interface Settings {
  /** Marge en % [margin]. */
  margin: number;
  /** [reuse] */
  reuseOffcuts: boolean;
  /** Perte par coupe [kerf]. */
  kerf: number;
  /** Plus petite chute gardée [minr]. */
  minOffcut: number;
}

export type RoomWall = 'A' | 'B' | 'C' | 'D';

export interface RoomSpec {
  /** [L] */
  length: number;
  /** [l] */
  width: number;
  /** Indice de surface par mur et pour le sol [surf]. */
  walls: Partial<Record<RoomWall | 'floor', number>>;
}

/** Joints d'une pièce du plan entre ses surfaces carrelées (silicone, profilés d'angle). */
export interface RoomJointsSpec {
  /** Indice de surface de chaque mur, dans l'ordre du contour ; null : mur non carrelé. */
  walls: (number | null)[];
  /** Angle au début de chaque mur (point i du contour) : rentrant ou sortant. */
  corners: ('in' | 'out')[];
  /** Profilé sur les angles sortants entre deux murs carrelés. */
  outerCovered: boolean;
  /** Indice de la surface du sol ; null : sol non carrelé. */
  floor: number | null;
  /** Longueur du joint sol/murs carrelés, mm. */
  perimeter: number;
}

export interface ProjectSpec {
  surfaces: SurfaceSpec[];
  settings: Settings;
  /** Pièce rectangulaire A–D de legacy (parité). */
  room: RoomSpec | null;
  /** Pièces du plan : joints entre leurs surfaces. */
  rooms?: RoomJointsSpec[];
}

/* ---------- sorties ---------- */

export interface RevealRef {
  /** Indice de l'ouverture. */
  opening: number;
  side: Side;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** Ce qui identifie le produit pour l'affichage (« 600 × 300 mm », « Hexagone 200 mm »…). */
export interface ProductLabel {
  shape: TileShape;
  size: [number, number];
}

export interface Piece {
  surface: number;
  zone: number;
  /** Parties posées, repère surface ; null pour une plinthe. */
  parts: Polygon[] | null;
  outline: Segment[];
  /** Arêtes coupées sur un bord visible. */
  vis: Segment[];
  full: boolean;
  thin: boolean;
  atFold: boolean;
  /** Nombre de prises à percer dans la pièce [drill]. */
  drill: number;
  notch: boolean;
  /** Pièce rectangulaire (coupe droite). */
  rect: boolean;
  /** Repère de texture : origine, extrémité x, extrémité y. */
  img: [Point, Point, Point] | null;
  /** Dimensions de la pièce dans le repère carreau canonique. */
  pw: number;
  ph: number;
  /** Dimensions du carreau tel que posé. */
  fw: number;
  fh: number;
  minD: number;
  /** Côtés qui doivent être des bords d'usine. */
  req: SideFlags;
  /** Parité de cellule (alternance, colonne Hongrie). */
  par: number;
  kind: 'main' | 'cab';
  shape: TileShape;
  /** Contour dans le repère carreau canonique (formes rectangulaires). */
  tf: Polygon | null;
  tW: number;
  tH: number;
  tA: number;
  /** Carreau et parties centrés (formes non rectangulaires). */
  tpoly: Polygon | null;
  pparts: Polygon[] | null;
  reveal: RevealRef | null;
  plinth: boolean;
  color: string;
  /** Clé produit (forme, dimensions, couleur). */
  key: string;
  label: ProductLabel;
  m2PerBox: number;
  /** Sens du carreau, pour le réemploi. */
  orientation: Orientation;
}

/** Pièce avant attribution de couleur et de produit (sortie de buildZone, tableaux, plinthes). */
export type RawPiece = Omit<Piece, 'surface' | 'color' | 'key' | 'label' | 'm2PerBox' | 'orientation'>;

/** Alertes de calcul d'une surface ; le texte est produit par l'interface. */
export type SurfaceWarning =
  | { code: 'zones-overflow'; amount: number }
  | { code: 'zones-gap'; amount: number }
  | { code: 'reveal-pattern'; opening: number }
  | { code: 'plinth-pattern' }
  | { code: 'plinth-too-high' };

/** Erreur bloquante d'une surface. */
export type SurfaceError =
  | { code: 'invalid-surface' }
  | { code: 'no-zone' }
  | { code: 'invalid-tile'; zone: number }
  | { code: 'too-many-tiles'; estimate: number };

export interface CutTile {
  n: number;
  /** Indices des pièces taillées dans ce carreau. */
  pieces: number[];
}

export interface ProductGroup {
  key: string;
  shape: TileShape;
  tileWidth: number;
  tileHeight: number;
  tileArea: number;
  label: ProductLabel;
  color: string;
  m2PerBox: number;
  orientation: Orientation;
  kind: 'main' | 'cab';
  zones: { surface: number; zone: number }[];
  full: number;
  cuts: number[];
  tiles: CutTile[];
}

export interface CutPlan {
  groups: ProductGroup[];
  /** Numéro du carreau source de chaque pièce coupée, null pour une entière. */
  source: (number | null)[];
  reused: boolean[];
}
