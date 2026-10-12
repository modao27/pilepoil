/** Résultats du module pour l'écran Résultats commun, chargés à la demande (hors du premier chargement). */
import type { ModuleResults } from '../../../types';
import type { ProjectResult } from '../../core';
import { tilingReport } from './results';

export const results: ModuleResults<ProjectResult> = {
  report: tilingReport,
  section: () => import('../results/TilingSection.svelte').then((m) => m.default),
  exports: () => import('./resultExports').then((m) => m.exports),
};
