/** Valeurs par défaut du module peinture (docs/peinture/SPEC.md §3). */
import type { PaintPoseSettings, Support, SupportState } from './types';

/** Seuil de déduction des ouvertures : 1 m², en mm². */
export const OPENING_THRESHOLD = 1_000_000;

/** Coefficient sur les rendements selon le support (SPEC §3.3). */
export const SUPPORT_YIELD: Record<Support, number> = { painted: 1, plaster: 0.8, concrete: 0.7 };

/** Enduit, kg par m² selon l'état du support (SPEC §3.2). */
export const FILLER_RATE: Record<SupportState, number> = { good: 0, average: 0.3, poor: 1 };

/** Consommables (SPEC §3.6) : longueur d'un rouleau de masquage, mm ; surface d'une bâche, mm². */
export const MASKING_ROLL = 50_000;
export const SHEET_AREA = 20_000_000;

export function defaultPoseSettings(): PaintPoseSettings {
  return {
    finish: null,
    color: null,
    coats: 2,
    primer: null,
    filler: null,
    fillerState: 'good',
    support: 'painted',
    margin: 0.1,
    openings: { mode: 'threshold', threshold: OPENING_THRESHOLD },
    woodwork: {
      skirting: false,
      skirtingHeight: 100,
      frames: false,
      frameWidth: 120,
      doors: false,
      doorFaces: 2,
      finish: null,
      color: null,
      coats: 2,
      primer: null,
    },
    consumables: { masking: false, sheet: false, roller: false, brush: false },
  };
}
