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
