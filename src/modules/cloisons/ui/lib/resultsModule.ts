/** Résultats du module pour l'écran Résultats commun, chargés à la demande (hors du premier chargement). */
import type { ModuleResults } from '../../../types';
import type { CloisonsResult } from '../../core/types';
import { cloisonsReport } from './results';

export const results: ModuleResults<CloisonsResult> = {
  report: cloisonsReport,
  section: () => import('../results/CloisonsSection.svelte').then((m) => m.default),
  exports: () => import('./resultExports').then((m) => m.exports),
};
