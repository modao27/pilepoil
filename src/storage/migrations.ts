import { rectRoom } from '../core/plan/factories';
import type { Plan } from '../core/plan/types';
import { moduleById } from '../modules/registry';
import { PROJECT_SCHEMA, type ModuleDoc, type Project, type ProjectV1 } from '../state/model';

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

/** Version des données carrelage créées par la migration v1 → v2 (CARRELAGE_SCHEMA du module). */
const CARRELAGE_V1 = 1;

/**
 * Projet v1 (carrelage seul) → v2 (docs/BOITE.md §4) : surfaces, pièce, réglages et prix passent dans
 * `modules.carrelage.data` ; plan vide, ou une pièce rectangulaire longueur × largeur nommée comme le projet
 * si la pièce carrelage existe (murs de 72 mm). Identifiants dérivés de celui du projet : déterministe.
 */
export function projectFromV1(v1: Omit<ProjectV1, 'schemaVersion'>): Project {
  const plan: Plan = { rooms: [], passages: [] };
  if (v1.room) {
    let n = 0;
    const id = () => `${v1.id}:plan:${n++}`;
    plan.rooms.push(rectRoom(v1.room.length, v1.room.width, { name: v1.name, height: v1.room.height }, id));
  }
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: v1.id,
    name: v1.name,
    createdAt: v1.createdAt,
    updatedAt: v1.updatedAt,
    plan,
    modules: {
      carrelage: {
        schemaVersion: CARRELAGE_V1,
        data: { surfaces: v1.surfaces, room: v1.room, settings: v1.settings, prices: v1.prices },
      },
    },
  };
}

/* Étapes par type de document. Ajouter ici `n: (doc) => …` à chaque montée de schéma, avec un test. */
export const PROJECT_STEPS: Record<number, Step> = {
  1: (doc) => projectFromV1(doc as unknown as ProjectV1) as unknown as Record<string, unknown>,
};
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
      Object.entries(def.migrations).map(([v, f]) => [v, (d: Record<string, unknown>) => ({ ...d, data: f(d.data) })]),
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
