/** Textes des erreurs du plan (codes de core/plan/validate.ts) : ce qui ne va pas, puis comment corriger. */
import type { PlanErrorCode } from '../../core/plan/validate';
import type { WorksErrorCode } from '../../core/plan/works';

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

/** Textes des problèmes des travaux (codes de core/plan/works.ts) : ce qui ne va pas, puis comment corriger. */
export const WORKS_MESSAGES: Record<WorksErrorCode, string> = {
  'partition/too-short': 'Une cloison est trop courte. Allongez-la ou supprimez-la.',
  'partition/outside': 'Une cloison sort des pièces. Ses deux bouts doivent toucher une pièce.',
  'partition/crosses-wall': 'Une cloison traverse un mur. Arrêtez-la contre le mur, ou démolissez le mur d’abord.',
  'partition/crosses-locked':
    'Une cloison traverse un mur verrouillé (extérieur ou porteur). Arrêtez-la contre le mur.',
  'partition/crosses-partition': 'Deux cloisons se croisent. Arrêtez l’une contre l’autre.',
  'partition/crosses-obstacle': 'Une cloison passe dans un obstacle. Déplacez la cloison ou l’obstacle.',
  'partition/over-opening': 'Une cloison tombe sur une fenêtre ou une porte : elle est partagée entre les deux pièces.',
  'partition/opening-size': 'Une porte de cloison a une taille nulle. Indiquez sa largeur et sa hauteur.',
  'partition/opening-outside': 'Une porte dépasse de sa cloison. Réduisez sa largeur ou déplacez-la.',
  'partition/opening-overlap': 'Deux portes se chevauchent sur une cloison. Déplacez l’une d’elles.',
  'demolition/wall-missing': 'Une démolition vise un mur qui n’existe plus. Supprimez-la.',
  'demolition/locked': 'Une démolition vise un mur verrouillé. Déverrouillez le mur ou supprimez la démolition.',
  'demolition/range': 'Une démolition sort de son mur ou est trop courte. Corrigez ses bornes.',
  'demolition/no-neighbour': 'Une démolition vise un mur sans pièce en face. Vérifiez que le mur sépare deux pièces.',
  'derive/sliver': 'Un travail laisse un morceau de pièce minuscule. Déplacez la cloison.',
  'derive/invalid-room': 'Une pièce après travaux n’est pas valide. Modifiez la cloison ou la démolition en cause.',
  'derive/passage-lost': 'Un passage ne relie plus deux portes face à face à cause des travaux.',
};
