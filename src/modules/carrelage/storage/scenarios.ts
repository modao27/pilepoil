/**
 * Magasin `scenarios` du carrelage (docs/BOITE.md §4) : lecture, écriture, photos utilisées.
 * La coquille supprime les scénarios avec leur projet (index `projectId`).
 */
import type { Id } from '../../../state/model';
import type { Db } from '../../../storage/db';
import { SCENARIO_SCHEMA, type Scenario } from '../state/model';

export async function listScenarios(db: Db, projectId: Id): Promise<Scenario[]> {
  const all = await db.getAllFromIndex('scenarios', 'projectId', projectId);
  // scénarios d'avant le carrelage bâti sur le plan : supprimés, sans conversion (PLAN C2)
  for (const s of all as { id: Id; schemaVersion?: number }[])
    if ((s.schemaVersion ?? 0) < SCENARIO_SCHEMA) void db.delete('scenarios', s.id);
  return (all as Scenario[])
    .filter((s) => s.schemaVersion === SCENARIO_SCHEMA)
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
