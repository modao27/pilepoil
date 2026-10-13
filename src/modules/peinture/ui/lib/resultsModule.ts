/** Résultats du module pour l'écran Résultats commun, chargés à la demande (hors du premier chargement). */
import type { ModuleResults } from '../../../types';
import type { PeintureResult } from '../../core/types';
import { peintureReport } from './results';

export const results: ModuleResults<PeintureResult> = {
  report: peintureReport,
  section: () => import('../results/PeintureSection.svelte').then((m) => m.default),
  exports: () => import('./resultExports').then((m) => m.exports),
};
