/** Résultats du module pour l'écran Résultats commun (CL3 : rapports, PDF). Les cloisons n'ont pas de pose : rien ici. */
import type { ModuleResults } from '../../../types';
import type { CloisonsResult } from '../../core/types';

export const results: ModuleResults<CloisonsResult> = {
  report: () => [],
  section: () => import('../screens/ResultsSection.svelte').then((m) => m.default),
  exports: async () => ({ pdf: () => undefined, meshes: () => [] }),
};
