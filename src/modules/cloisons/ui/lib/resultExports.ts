/** PDF et 3D des cloisons pour l'écran Résultats commun (chargés à la demande, avec jsPDF). */
import type { ResultExports } from '../../../types';
import type { CloisonsResult } from '../../core/types';
import { writeCloisonsResults } from './pdf';

/** Les cloisons sont des murs du plan après travaux : l'enveloppe 3D les dessine déjà, rien à ajouter. */
export const exports: ResultExports<CloisonsResult> = {
  pdf: writeCloisonsResults,
  meshes: () => [],
};
