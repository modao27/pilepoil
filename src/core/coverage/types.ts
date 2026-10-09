/**
 * Zones et poses (docs/NAVIGATION.md §4) : quelles parties de quelles surfaces du plan reçoivent quel
 * revêtement. Partagé par tous les modules ; chaque module garde seulement les réglages de ses poses.
 * Unités : mm.
 */
import type { Segment } from '../geometry/types';
import type { Id } from '../plan/types';

/** Le sol d'une pièce (wall null) ou un de ses murs. */
export interface SurfaceRef {
  room: Id;
  wall: Id | null;
}

/**
 * Ligne de découpe : on garde le côté de la normale (−dy, dx) × side, d étant la direction de line[0] vers line[1]
 * (même convention que les limites de zone du parquet). Repère de la pièce pour un sol (y vers le bas), repère du
 * mur pour un mur (x depuis le début du mur, y depuis le sol, vers le haut).
 */
export interface Cut {
  line: Segment;
  side: 1 | -1;
}

/** Partie d'une surface qui reçoit un revêtement : la surface coupée par ses lignes (aucune : toute la surface). */
export interface Zone {
  id: Id;
  surface: SurfaceRef;
  cuts: Cut[];
  /** Pose à laquelle la zone appartient. */
  pose: Id;
}

/** Revêtement continu (un module, ses réglages) sur une ou plusieurs zones. */
export interface Pose {
  id: Id;
  module: string;
  name: string;
}

/** Ce que chaque module accepte (contrat de module). */
export interface CoverageRules {
  /** Types de surface acceptés. */
  surfaces: readonly ('floor' | 'wall')[];
  /**
   * Étendue d'une pose : une seule surface ; des sols de pièces reliées par des passages ; ou « continue » : des
   * sols reliés, ou des murs d'une même pièce qui se suivent (le tour complet compris).
   */
  extent: 'surface' | 'connected-floors' | 'continuous';
}
