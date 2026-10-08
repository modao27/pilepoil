/**
 * Magasin `scenarios` du carrelage (docs/BOITE.md §4) : lecture (migrée), écriture, photos utilisées.
 * La coquille supprime les scénarios avec leur projet (index `projectId`).
 */
import type { Id } from '../../../state/model';
import type { Db } from '../../../storage/db';
import { migrate, migrateProject, type Step } from '../../../storage/migrations';
import { SCENARIO_SCHEMA, type Scenario } from '../state/model';

/* Étapes du document scénario. Ajouter ici `n: (doc) => …` à chaque montée de schéma, avec un test. */
export const SCENARIO_STEPS: Record<number, Step> = {
  /** L'instantané est migré comme un projet. */
  1: (doc) => ({
    ...doc,
    snapshot: {
      ...(doc.snapshot as object),
      project: migrateProject((doc.snapshot as { project: unknown }).project).doc,
    },
  }),
};

export const migrateScenario = (doc: unknown) => migrate<Scenario>(doc, SCENARIO_SCHEMA, SCENARIO_STEPS);

export async function listScenarios(db: Db, projectId: Id): Promise<Scenario[]> {
  const all = await db.getAllFromIndex('scenarios', 'projectId', projectId);
  return all
    .map((raw) => {
      const { doc, changed } = migrateScenario(raw);
      if (changed) void db.put('scenarios', doc);
      return doc;
    })
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

/** Un seul scénario par emplacement A/B : l'ancien est remplacé. Renvoie true si un ancien a été retiré. */
export async function saveScenario(db: Db, s: Scenario): Promise<boolean> {
  const old = ((await db.getAllFromIndex('scenarios', 'projectId', s.projectId)) as Scenario[]).filter(
    (o) => o.slot === s.slot && o.id !== s.id,
  );
  const tx = db.transaction('scenarios', 'readwrite');
  for (const o of old) await tx.store.delete(o.id);
  await tx.store.put(s);
  await tx.done;
  return old.length > 0;
}

export async function deleteScenario(db: Db, id: Id): Promise<void> {
  await db.delete('scenarios', id);
}

/** Photos des scénarios (vignette, carreaux figés), à garder au ramassage. */
export async function scenarioPhotos(db: Db): Promise<Id[]> {
  const used: Id[] = [];
  for (const s of (await db.getAll('scenarios')) as Scenario[]) {
    if (s.thumbnailId) used.push(s.thumbnailId);
    for (const t of s.snapshot.tiles) if (t.photoId) used.push(t.photoId);
  }
  return used;
}
