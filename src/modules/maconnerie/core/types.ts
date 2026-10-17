/** Types du module maçonnerie (docs/materiaux/SPEC.md) : matériaux de la bibliothèque et technique de pose. */
export const MATERIAL_SCHEMA = 1;

export type MaterialFamily = 'parpaing' | 'brique' | 'beton-cellulaire' | 'carreau-platre' | 'pave-verre';

export type Binder = 'mortier' | 'mortier-semi-epais' | 'joint-mince' | 'colle' | 'mortier-colle';

/** Épaisseur d'un joint, en millimètres. */
export interface JointRange {
  min: number;
  def: number;
  max: number;
}

/** Armature d'un panneau (briques de verre) : fers de `diameter` mm, à `minCover` mm au moins de l'extérieur. */
export interface Reinforcement {
  diameter: { min: number; max: number };
  minCover: number;
}

export interface LayingTechnique {
  jointH: JointRange;
  /** null : joints verticaux secs. */
  jointV: JointRange | null;
  /** running : à demi-longueur ; stack : joints alignés. */
  bond: 'running' | 'stack';
  /** Recouvrement mini des joints verticaux (mm) ; 0 si sans objet. */
  minOverlap: number;
  binder: Binder;
  /** kg de liant par m² de mur ; null : à saisir. */
  binderPerM2: number | null;
  cutAllowed: boolean;
  reinforcement: Reinforcement | null;
}

/** Compatible avec `LibraryItem` (modules/types), sans l'importer : le noyau reste sans DOM. */
export interface Material {
  id: string;
  name: string;
  updatedAt: number;
  photoId?: string | null;
  schemaVersion: number;
  family: MaterialFamily;
  /** Dimensions en millimètres. */
  length: number;
  height: number;
  thickness: number;
  /** kg par élément ; null : à compléter. */
  weight: number | null;
  laying: LayingTechnique;
  createdAt: number;
}

/* ---------------------------------------------------------------- moteur */

/** Rectangle dans l'élévation d'un mur (mm) : x depuis le début du mur, y depuis le sol. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Zone d'un autre matériau dans un mur (panneau de briques de verre, bande…), prête pour le calcul. */
export interface ZoneSpec extends Rect {
  id: string;
  material: Material;
  joint: number;
}

/** Un mur ou un panneau à monter, prêt pour le calcul. Dimensions en mm. */
export interface WallSpec {
  id: string;
  name: string;
  length: number;
  height: number;
  /** Matériau de base : il remplit le mur autour des zones et des ouvertures. */
  material: Material;
  /** Joint retenu (mm), horizontal et vertical quand il y en a. */
  joint: number;
  zones: ZoneSpec[];
  /** Portes et baies : rien n'y est monté. */
  holes: Rect[];
}

export interface MaconnerieSpec {
  walls: WallSpec[];
  /** Marge de casse et de coupe sur les éléments (0,05 = 5 %). */
  margin: number;
}

export type AlertCode =
  | 'glass-not-cuttable'
  | 'panel-area-exceeds-max'
  | 'joint-out-of-range'
  | 'binder-unknown'
  | 'too-small'
  | 'zone-outside'
  | 'zone-overlap'
  | 'zone-on-opening';

export interface MasonryAlert {
  code: AlertCode;
  wall: string;
  /** Zone concernée ; absent : le matériau de base. */
  zone?: string;
  params?: Record<string, number>;
}

/** Panneau de briques de verre : éléments entiers, bordures périphériques. */
export interface GlassLayout {
  cols: number;
  rows: number;
  /** Bordure de chaque côté (mm). */
  borderX: number;
  borderY: number;
  /** Longueur totale de fers d'armature (mm). */
  reinforcement: number;
}

/** Quantités d'une surface d'un seul matériau (la base d'un mur, ou une zone). */
export interface SurfaceResult {
  /** Matériau. */
  material: string;
  ok: boolean;
  courses: number;
  /** Éléments posés, coupés compris. */
  elements: number;
  /** Éléments coupés. */
  cut: number;
  /** Surface montée (m²), trous déduits. */
  area: number;
  binderKg: number | null;
  weightKg: number | null;
  glass: GlassLayout | null;
}

export interface ZoneResult extends SurfaceResult {
  id: string;
}

export interface WallResult extends SurfaceResult {
  id: string;
  zones: ZoneResult[];
  /** Alertes du mur, base et zones. */
  alerts: MasonryAlert[];
}

export interface MaterialTotal {
  material: string;
  name: string;
  elements: number;
  /** Éléments à acheter, marge comprise. */
  purchased: number;
  binder: Binder;
  binderKg: number | null;
  weightKg: number | null;
  /** Fers d'armature (mm). */
  reinforcement: number;
}

export interface MaconnerieResult {
  walls: WallResult[];
  totals: MaterialTotal[];
  alerts: MasonryAlert[];
}
