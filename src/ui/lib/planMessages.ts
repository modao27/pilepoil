/** Textes des erreurs du plan (codes de core/plan/validate.ts) : ce qui ne va pas, puis comment corriger. */
import type { PlanErrorCode } from '../../core/plan/validate';

export const PLAN_MESSAGES: Record<PlanErrorCode, string> = {
  'room/too-few-points': 'Une pièce a moins de 3 points. Ajoutez des points ou supprimez-la.',
  'room/walls-count': 'Les murs d’une pièce ne correspondent plus à son contour. Annulez la dernière action.',
  'room/self-intersecting': 'Des murs se croisent. Déplacez un point pour les séparer.',
  'room/area': 'Une pièce n’a pas de surface. Écartez ses points.',
  'room/height': 'La hauteur sous plafond doit être positive.',
  'wall/thickness': 'Un mur a une épaisseur nulle. Indiquez son épaisseur.',
  'obstacle/outside': 'Un obstacle dépasse de la pièce. Déplacez-le à l’intérieur.',
  'opening/wall-missing': 'Une ouverture n’est plus sur un mur. Supprimez-la.',
  'opening/size': 'Une ouverture a une taille nulle. Indiquez sa largeur et sa hauteur.',
  'opening/outside-wall': 'Une ouverture dépasse de son mur. Réduisez sa largeur ou déplacez-la.',
  'opening/overlap': 'Deux ouvertures se chevauchent sur un mur. Déplacez l’une d’elles.',
  'passage/missing': 'Un passage relie une porte qui n’existe plus. Supprimez-le.',
  'passage/width': 'Les deux portes d’un passage n’ont pas la même largeur.',
  'passage/not-facing': 'Les deux portes d’un passage ne se font plus face. Reliez-les à nouveau.',
};
