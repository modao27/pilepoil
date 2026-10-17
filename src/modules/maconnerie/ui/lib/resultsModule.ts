/** Résultats du module pour l'écran Résultats commun, chargés à la demande (hors du premier chargement). */
import type { ModuleResults } from '../../../types';
import type { MaconnerieResult } from '../../core/types';
import { SPEC_ERRORS } from './messages';
import { maconnerieReport } from './results';

export const results: ModuleResults<MaconnerieResult> = {
  report: maconnerieReport,
  errorText: (e) => SPEC_ERRORS[e.code] ?? 'Le calcul ne peut pas se faire : vérifiez les réglages.',
  section: () => import('../results/MaconnerieSection.svelte').then((m) => m.default),
  exports: () => import('./resultExports').then((m) => m.exports),
};
