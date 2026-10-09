import { moduleById } from '../modules/registry';
import { PROJECT_SCHEMA, type ModuleDoc, type Project } from '../state/model';

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

/* Étapes du projet. Ajouter ici `n: (doc) => …` à chaque montée de schéma, avec un test. Les projets v1 (avant
   la boîte à outils) ne sont plus lus : la base v3 les a retirés (db.ts). */
export const PROJECT_STEPS: Record<number, Step> = {};
export const migrateProject = (doc: unknown) => migrateModules(migrate<Project>(doc, PROJECT_SCHEMA, PROJECT_STEPS));

/**
 * Migre les données de chaque module avec les étapes du module (`migrations`, version `schemaVersion`).
 * Données d'un module inconnu (version plus récente de l'application) : laissées telles quelles.
 */
function migrateModules(r: { doc: Project; changed: boolean }): { doc: Project; changed: boolean } {
  let changed = r.changed;
  const modules: Record<string, ModuleDoc> = {};
  for (const [id, m] of Object.entries(r.doc.modules)) {
    const def = moduleById(id);
    if (!def) {
      modules[id] = m;
      continue;
    }
    const steps: Record<number, Step> = Object.fromEntries(
      // migrations[n] du module : n − 1 → n ; étapes de `migrate` : steps[n] : n → n + 1
      Object.entries(def.migrations).map(([v, f]) => [
        Number(v) - 1,
        (d: Record<string, unknown>) => ({ ...d, data: f(d.data) }),
      ]),
    );
    const out = migrate<{ schemaVersion: number; data: unknown }>(
      { schemaVersion: m.schemaVersion, data: m.data },
      def.schemaVersion,
      steps,
    );
    modules[id] = { schemaVersion: out.doc.schemaVersion as number, data: out.doc.data };
    changed ||= out.changed;
  }
  return changed ? { doc: { ...r.doc, modules }, changed } : r;
}
