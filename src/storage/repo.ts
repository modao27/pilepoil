import type { LibraryItem } from '../modules/types';
import type { Id, Photo, Pref, PrefKey, PrefValue, Project, Scenario } from '../state/model';
import type { Db } from './db';
import { migrateProject, migrateScenario } from './migrations';

/* ---------- projets ---------- */

/** Projets du plus récent au plus ancien. */
export async function listProjects(db: Db): Promise<Project[]> {
  const all = await db.getAllFromIndex('projects', 'updatedAt');
  return all.map((p) => readProject(db, p)).reverse();
}

export async function getProject(db: Db, id: Id): Promise<Project | undefined> {
  const raw = await db.get('projects', id);
  return raw && readProject(db, raw);
}

/** Migre à la lecture ; le document migré est réécrit en tâche de fond. */
function readProject(db: Db, raw: unknown): Project {
  const { doc, changed } = migrateProject(raw);
  if (changed) void db.put('projects', doc);
  return doc;
}

export async function saveProject(db: Db, p: Project): Promise<void> {
  await db.put('projects', p);
}

/** Supprime le projet, ses scénarios et les photos devenues orphelines. */
export async function deleteProject(db: Db, id: Id): Promise<void> {
  const tx = db.transaction(['projects', 'scenarios'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  const scen = tx.objectStore('scenarios');
  for (const key of await scen.index('projectId').getAllKeys(id)) await scen.delete(key);
  await tx.done;
  await collectPhotos(db);
}

/* ---------- bibliothèques de produits (carreaux, lames) ---------- */

/** Magasins de bibliothèque : `LibraryDefinition.store` des modules. */
export const LIBRARY_STORES = ['tiles', 'boards'] as const;
export type LibraryStore = (typeof LIBRARY_STORES)[number];

export function libraryStore(store: string): LibraryStore {
  if (!(LIBRARY_STORES as readonly string[]).includes(store)) throw new Error(`Magasin inconnu : ${store}`);
  return store as LibraryStore;
}

/** Documents bruts (migrés par la coquille avec les étapes du module). */
export function listItems(db: Db, store: LibraryStore): Promise<unknown[]> {
  return db.getAll(store);
}

export async function putItem(db: Db, store: LibraryStore, item: LibraryItem): Promise<void> {
  await db.put(store, item as never);
}

export async function deleteItem(db: Db, store: LibraryStore, id: Id): Promise<void> {
  await db.delete(store, id);
  await collectPhotos(db);
}

/* ---------- photos ---------- */

export async function savePhoto(db: Db, photo: Photo): Promise<void> {
  await db.put('photos', photo);
}

export function getPhoto(db: Db, id: Id): Promise<Photo | undefined> {
  return db.get('photos', id);
}

/** Supprime les photos qu'aucun carreau ni scénario ne référence. Renvoie le nombre supprimé. */
export async function collectPhotos(db: Db): Promise<number> {
  const used = new Set<Id>();
  for (const s of LIBRARY_STORES)
    for (const t of (await db.getAll(s)) as LibraryItem[]) if (t.photoId) used.add(t.photoId);
  for (const s of await db.getAll('scenarios')) {
    if (s.thumbnailId) used.add(s.thumbnailId);
    for (const t of s.snapshot.tiles) if (t.photoId) used.add(t.photoId);
  }
  let n = 0;
  for (const key of await db.getAllKeys('photos')) {
    if (!used.has(key)) {
      await db.delete('photos', key);
      n++;
    }
  }
  return n;
}

/* ---------- scénarios ---------- */

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

/** Un seul scénario par emplacement A/B : l'ancien est remplacé. */
export async function saveScenario(db: Db, s: Scenario): Promise<void> {
  const old = (await db.getAllFromIndex('scenarios', 'projectId', s.projectId)).filter(
    (o) => o.slot === s.slot && o.id !== s.id,
  );
  const tx = db.transaction('scenarios', 'readwrite');
  for (const o of old) await tx.store.delete(o.id);
  await tx.store.put(s);
  await tx.done;
  if (old.length) await collectPhotos(db);
}

export async function deleteScenario(db: Db, id: Id): Promise<void> {
  await db.delete('scenarios', id);
  await collectPhotos(db);
}

/* ---------- préférences ---------- */

export async function getPref<K extends PrefKey>(db: Db, key: K): Promise<PrefValue<K> | undefined> {
  const p = await db.get('prefs', key);
  return p?.value as PrefValue<K> | undefined;
}

export async function setPref<K extends PrefKey>(db: Db, key: K, value: PrefValue<K>): Promise<void> {
  await db.put('prefs', { key, value } as Extract<Pref, { key: K }>);
}
