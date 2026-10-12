/** Résultats du module pour l'écran Résultats commun, chargés à la demande (hors du premier chargement). */
import type { ModuleResults } from '../../../types';
import type { ParquetResult } from '../../core/types';
import { parquetReport } from './results';

export const results: ModuleResults<ParquetResult> = {
  report: parquetReport,
  section: () => import('../results/ParquetSection.svelte').then((m) => m.default),
  exports: () => import('./resultExports').then((m) => m.exports),
};
