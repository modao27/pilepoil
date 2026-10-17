/**
 * Obstacles et équipements fixes d'une pièce (poteau, WC, receveur…) : nom, taille usuelle et sort du sol dessous.
 * Un équipement posé sur un sol déjà revêtu (WC, lavabo, lave-linge) laisse le revêtement passer dessous ; un receveur,
 * une baignoire, un meuble ou un poteau sont des trous dans le revêtement.
 */
import type { Obstacle, PlanRoom } from './types';

export type ObstacleKind = Obstacle['kind'];

export interface EquipmentInfo {
  label: string;
  /** Encombrement usuel au sol, mm : largeur (le long de x) × profondeur. */
  width: number;
  depth: number;
  /** Le revêtement du sol passe dessous (sinon l'élément est un trou dans le sol revêtu). */
  floorUnder: boolean;
}

export const EQUIPMENT: Record<ObstacleKind, EquipmentInfo> = {
  post: { label: 'Poteau', width: 300, depth: 300, floorUnder: false },
  island: { label: 'Îlot', width: 1200, depth: 600, floorUnder: false },
  duct: { label: 'Conduit', width: 200, depth: 200, floorUnder: false },
  other: { label: 'Autre', width: 500, depth: 500, floorUnder: false },
  toilet: { label: 'WC', width: 400, depth: 700, floorUnder: true },
  basin: { label: 'Lavabo', width: 600, depth: 500, floorUnder: true },
  shower: { label: 'Receveur de douche', width: 900, depth: 900, floorUnder: false },
  bath: { label: 'Baignoire', width: 1700, depth: 750, floorUnder: false },
  sink: { label: 'Évier, meuble de cuisine', width: 1200, depth: 600, floorUnder: false },
  washer: { label: 'Lave-linge', width: 600, depth: 600, floorUnder: true },
};

/** Équipements proposés à l'ajout (le poteau, l'îlot, le conduit et « autre » ont leur bouton d'obstacle). */
export const EQUIPMENT_KINDS: readonly ObstacleKind[] = ['toilet', 'basin', 'shower', 'bath', 'sink', 'washer'];

/** Le revêtement du sol passe-t-il sous cet élément ? Le choix de l'utilisateur, sinon l'usage de son type. */
export const floorUnder = (o: Pick<Obstacle, 'kind' | 'floorUnder'>): boolean =>
  o.floorUnder ?? EQUIPMENT[o.kind].floorUnder;

/** Éléments qui trouent le sol revêtu de la pièce. */
export const floorHoles = (room: Pick<PlanRoom, 'obstacles'>): Obstacle[] =>
  room.obstacles.filter((o) => !floorUnder(o));
