/** Identité du module carrelage, sans dépendance (chargée au démarrage avec le manifeste). */
import type { CoverageRules } from '../../../core/coverage/types';

export const CARRELAGE_ID = 'carrelage';
export const CARRELAGE_SCHEMA = 3;

/** Règles des zones de carrelage (aussi déclarées dans le contrat du module). */
export const TILE_RULES: CoverageRules = { surfaces: ['floor', 'wall'], extent: 'continuous' };
