/** Résultats du module pour l'écran Résultats commun : rien à montrer avant les murets. */
import type { ModuleResults } from '../../../types';
import type { MaconnerieResult } from '../../core/compute';

export const results: ModuleResults<MaconnerieResult> = {
  report: () => [],
  errorText: (e) =>
    e.code === 'maconnerie/no-wall'
      ? 'Aucun mur de maçonnerie dans ce projet.'
      : 'Le calcul ne peut pas se faire : vérifiez les réglages.',
  section: () => import('../results/MaconnerieSection.svelte').then((m) => m.default),
  exports: async () => ({ pdf: () => undefined, meshes: () => [] }),
};
