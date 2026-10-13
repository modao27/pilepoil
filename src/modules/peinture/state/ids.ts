/** Règles des zones de la peinture, sans dépendance (chargées au démarrage avec le manifeste). */
import type { CoverageRules } from '../../../core/coverage/types';

/** La peinture se pose sur des murs, qui se suivent dans une même pièce (le tour complet compris). */
export const PEINTURE_RULES: CoverageRules = { surfaces: ['wall'], extent: 'continuous' };
