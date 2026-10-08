import { PROJECT_SCHEMA, SCENARIO_SCHEMA, TILE_SCHEMA, type Project, type Scenario, type Tile } from '../state/model';

/** Étape de migration : document en version n → version n + 1. */
export type Step = (doc: Record<string, unknown>) => Record<string, unknown>;

export class FutureVersionError extends Error {
  constructor(readonly version: number) {
    super(`Document créé par une version plus récente de l'application (schéma ${version}).`);
  }
}

/**
 * Amène un document à la version `current` en appliquant les étapes dans l'ordre.
 * `steps[n]` migre de n vers n + 1. Un document sans `schemaVersion` est en version 0.
 */
export function migrate<T>(
  doc: unknown,
  current: number,
  steps: Readonly<Record<number, Step>>,
): { doc: T; changed: boolean } {
  if (!doc || typeof doc !== 'object') throw new TypeError('Document illisible.');
  let d = doc as Record<string, unknown>;
  let v = typeof d.schemaVersion === 'number' ? d.schemaVersion : 0;
  if (v > current) throw new FutureVersionError(v);
  const changed = v < current;
  while (v < current) {
    const step = steps[v];
    if (!step) throw new Error(`Migration manquante : schéma ${v} → ${v + 1}.`);
    d = { ...step(d), schemaVersion: v + 1 };
    v++;
  }
  return { doc: d as T, changed };
}

/* Étapes par type de document. Ajouter ici `n: (doc) => …` à chaque montée de schéma, avec un test. */
export const PROJECT_STEPS: Record<number, Step> = {};
export const TILE_STEPS: Record<number, Step> = {};
export const SCENARIO_STEPS: Record<number, Step> = {};

export const migrateProject = (doc: unknown) => migrate<Project>(doc, PROJECT_SCHEMA, PROJECT_STEPS);
export const migrateTile = (doc: unknown) => migrate<Tile>(doc, TILE_SCHEMA, TILE_STEPS);
export const migrateScenario = (doc: unknown) => migrate<Scenario>(doc, SCENARIO_SCHEMA, SCENARIO_STEPS);
