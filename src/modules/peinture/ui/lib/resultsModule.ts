/** Résultats du module pour l'écran Résultats commun, chargés à la demande (hors du premier chargement). */
import type { ModuleResults } from '../../../types';
import { SPEC_ERRORS } from './messages';
import type { PeintureResult } from '../../core/types';
import { peintureReport } from './results';

export const results: ModuleResults<PeintureResult> = {
  report: peintureReport,
  errorText: (e) => SPEC_ERRORS[e.code] ?? 'Le calcul ne peut pas se faire : vérifiez les réglages.',
  section: () => import('../results/PeintureSection.svelte').then((m) => m.default),
  exports: () => import('./resultExports').then((m) => m.exports),
};
