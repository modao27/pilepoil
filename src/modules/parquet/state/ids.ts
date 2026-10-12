/** Règles des zones du parquet, sans dépendance (chargées au démarrage avec le manifeste). */
import type { CoverageRules } from '../../../core/coverage/types';

/** Le parquet se pose au sol, sur des pièces reliées par des passages. */
export const PARQUET_RULES: CoverageRules = { surfaces: ['floor'], extent: 'connected-floors' };
