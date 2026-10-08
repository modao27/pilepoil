/**
 * Plan commun à tous les modules (docs/BOITE.md §3). Unités : mm.
 * Types seuls en S1 ; validation et réducteur arrivent en S2.
 */
import type { Point, Polygon } from '../types';

export type Id = string;

export interface Plan {
  rooms: PlanRoom[];
  /** Portes ou ouvertures reliant deux pièces. */
  passages: Passage[];
}

export interface PlanRoom {
  id: Id;
  name: string;
  /** Contour intérieur fini des murs. Sens horaire à l'écran (y vers le bas) : signedArea > 0. */
  outline: Polygon;
  /** Un mur par segment du contour : walls[i] = segment du point i au point i + 1. */
  walls: Wall[];
  /** Trous dans le sol (poteau, îlot, conduit, trémie). */
  obstacles: Obstacle[];
  /** Portes, baies, fenêtres, sur un segment du contour. */
  openings: WallOpening[];
  /** Hauteur sous plafond, pour la 3D. */
  height: number;
  /** Position de la pièce dans le plan d'ensemble. */
  origin: Point;
}

export interface Wall {
  /** Stable : ne change pas quand on ajoute ou retire un point. */
  id: Id;
  /** Épaisseur du mur (passages, 3D). */
  thickness: number;
}

export interface Obstacle {
  id: Id;
  kind: 'post' | 'island' | 'duct' | 'other';
  /** Repère de la pièce. */
  outline: Polygon;
}

export interface WallOpening {
  id: Id;
  kind: 'door' | 'french-window' | 'window';
  /** Mur porteur de l'ouverture. */
  wall: Id;
  /** Depuis le début du mur (point i). */
  offset: number;
  width: number;
  /** 0 pour une porte. */
  sill: number;
  height: number;
}

export interface Passage {
  id: Id;
  a: { room: Id; opening: Id };
  b: { room: Id; opening: Id };
}
