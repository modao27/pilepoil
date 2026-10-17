/**
 * Plan commun à tous les modules (docs/BOITE.md §3). Unités : mm.
 * Types seuls en S1 ; validation et réducteur arrivent en S2.
 */
import type { Point, Polygon } from '../geometry/types';

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
  /** Hauteur sous plafond, depuis le sol de la pièce. */
  height: number;
  /** Niveau du sol fini par rapport au niveau 0 du plan, mm (absent : 0). Voir `levels.ts`. */
  floor?: number;
  /** Position de la pièce dans le plan d'ensemble. */
  origin: Point;
}

export interface Wall {
  /** Stable : ne change pas quand on ajoute ou retire un point. */
  id: Id;
  /** Épaisseur du mur (passages, 3D). */
  thickness: number;
  /** Hauteur propre du mur depuis le sol de la pièce, mm (absent : celle de la pièce) ; mur bas, allège. */
  height?: number;
  /** Mur qu'on ne démolit pas : extérieur ou porteur (docs/BOITE.md §3 bis). Absent : libre. */
  locked?: 'exterior' | 'bearing';
  /** Mur dérivé : face d'une cloison neuve. Posé par `planAfter`, jamais saisi ni enregistré. */
  of?: { partition: Id; face: 'a' | 'b' | 'start' | 'end' };
}

export interface Obstacle {
  id: Id;
  kind: 'post' | 'island' | 'duct' | 'other' | 'toilet' | 'basin' | 'shower' | 'bath' | 'sink' | 'washer';
  /** Repère de la pièce. */
  outline: Polygon;
  /** Le revêtement du sol passe dessous (choix de l'utilisateur) ; absent : l'usage de son type (`equipment.ts`). */
  floorUnder?: boolean;
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

/* ---------- plan v3 : état existant et travaux (docs/BOITE.md §3 bis) ---------- */

/** Ce qui est enregistré : l'état relevé, les cloisons neuves, les démolitions. */
export interface Site {
  existing: Plan;
  partitions: Partition[];
  demolitions: Demolition[];
  /** Noms choisis pour les pièces nées des travaux (clé : identifiant de la pièce dérivée). */
  names?: Record<Id, string>;
}

export interface Partition {
  id: Id;
  /** Axe tracé de a vers b, repère du plan. */
  a: Point;
  b: Point;
  /** Épaisseur finie : c'est elle qui découpe les pièces. */
  thickness: number;
  /** Épaisseur centrée sur l'axe, ou d'un seul côté (gauche : côté de la normale (dy, −dx), à l'écran). */
  align: 'center' | 'left' | 'right';
  openings: PartitionOpening[];
}

export interface PartitionOpening {
  id: Id;
  /** `opening` : baie sans porte. */
  kind: 'door' | 'opening';
  /** Depuis a, le long de l'axe. */
  offset: number;
  width: number;
  height: number;
}

export interface Demolition {
  id: Id;
  /** Mur de l'état existant. */
  room: Id;
  wall: Id;
  /** Intervalle le long du mur, depuis son point i. */
  from: number;
  to: number;
}
