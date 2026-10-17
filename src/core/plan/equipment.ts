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
  /** Hauteur du volume en 3D, mm ; `'room'` : du sol au plafond (poteau, conduit). */
  height: number | 'room';
  /** Le revêtement du sol passe dessous (sinon l'élément est un trou dans le sol revêtu). */
  floorUnder: boolean;
}

/**
 * Tailles et hauteurs de modèles courants du catalogue Leroy Merlin (fiches produits et guides d'achat) :
 * - WC à poser : cuvette de 40 à 45 cm abattant compris, haut du réservoir entre 70 et 80 cm, largeur 40 cm ;
 * - meuble simple vasque 59,5 × 45,2 cm, haut. 84 cm ; receveur extra-plat de 2,6 à 5 cm de haut (marche de moins de 5 cm) ;
 * - baignoire rectangulaire 170 × 70 cm, de 51 à 58 cm de haut selon les pieds ; plan de travail de cuisine à 85-90 cm ;
 * - lave-linge à hublot 60 × 60 × 85 cm (usage courant des fabricants).
 */
export const EQUIPMENT: Record<ObstacleKind, EquipmentInfo> = {
  post: { label: 'Poteau', width: 300, depth: 300, height: 'room', floorUnder: false },
  island: { label: 'Îlot', width: 1200, depth: 600, height: 900, floorUnder: false },
  duct: { label: 'Conduit', width: 200, depth: 200, height: 'room', floorUnder: false },
  other: { label: 'Autre', width: 500, depth: 500, height: 500, floorUnder: false },
  toilet: { label: 'WC', width: 400, depth: 700, height: 780, floorUnder: true },
  basin: { label: 'Lavabo', width: 600, depth: 450, height: 840, floorUnder: true },
  shower: { label: 'Receveur de douche', width: 900, depth: 900, height: 50, floorUnder: false },
  bath: { label: 'Baignoire', width: 1700, depth: 700, height: 580, floorUnder: false },
  sink: { label: 'Évier, meuble de cuisine', width: 1200, depth: 600, height: 900, floorUnder: false },
  washer: { label: 'Lave-linge', width: 600, depth: 600, height: 850, floorUnder: true },
};

/** Équipements proposés à l'ajout (le poteau, l'îlot, le conduit et « autre » ont leur bouton d'obstacle). */
export const EQUIPMENT_KINDS: readonly ObstacleKind[] = ['toilet', 'basin', 'shower', 'bath', 'sink', 'washer'];

/** Le revêtement du sol passe-t-il sous cet élément ? Le choix de l'utilisateur, sinon l'usage de son type. */
export const floorUnder = (o: Pick<Obstacle, 'kind' | 'floorUnder'>): boolean =>
  o.floorUnder ?? EQUIPMENT[o.kind].floorUnder;

/** Éléments qui trouent le sol revêtu de la pièce. */
export const floorHoles = (room: Pick<PlanRoom, 'obstacles'>): Obstacle[] =>
  room.obstacles.filter((o) => !floorUnder(o));
