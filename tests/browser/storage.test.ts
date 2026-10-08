import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProject as createView,
  createSurface,
  createTile,
  newId,
} from '../../src/modules/carrelage/state/factories';
import { migrateProject, migrateScenario, projectFromV1 } from '../../src/storage/migrations';
import { V1_ROOM, V1_SCENARIO } from '../unit/fixtures/v1';
import type { Photo, Project, Scenario } from '../../src/state/model';
import { DB_VERSION, openDb, type Db } from '../../src/storage/db';
import {
  collectPhotos,
  deleteProject,
  deleteTile,
  getPhoto,
  getPref,
  getProject,
  listProjects,
  listScenarios,
  listTiles,
  saveProject,
  savePhoto,
  saveScenario,
  saveTile,
  setPref,
} from '../../src/storage/repo';

/** Projet v2 avec le carrelage. */
const createProject = (...a: Parameters<typeof createView>): Project => projectFromV1(createView(...a));

const opened: { db: Db; name: string }[] = [];
async function fresh(): Promise<Db> {
  const name = 'test-' + newId();
  const db = await openDb(name);
  opened.push({ db, name });
  return db;
}
afterEach(async () => {
  for (const { db, name } of opened.splice(0)) {
    db.close();
    await deleteDB(name);
  }
});

const photo = (id = newId()): Photo => ({
  id,
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  width: 1,
  height: 1,
  createdAt: 0,
});
const scenario = (p: Project, slot: 'A' | 'B', o: Partial<Scenario> = {}): Scenario => ({
  schemaVersion: 2,
  id: newId(),
  projectId: p.id,
  slot,
  name: 'Scénario ' + slot,
  snapshot: { project: p, tiles: [] },
  metrics: null,
  thumbnailId: null,
  createdAt: 0,
  ...o,
});

describe('base IndexedDB', () => {
  it('crée les magasins à la version courante', async () => {
    const db = await fresh();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['boards', 'photos', 'prefs', 'projects', 'scenarios', 'tiles']);
  });

  it('projets : enregistrement, liste du plus récent au plus ancien, suppression avec scénarios', async () => {
    const db = await fresh();
    const t = createTile();
    const a = createProject([createSurface(t.id)], { name: 'A' }, 1000),
      b = createProject([createSurface(t.id)], { name: 'B' }, 2000);
    await saveProject(db, a);
    await saveProject(db, b);
    expect((await listProjects(db)).map((p) => p.name)).toEqual(['B', 'A']);
    expect(await getProject(db, a.id)).toEqual(a);
    await saveScenario(db, scenario(a, 'A'));
    await deleteProject(db, a.id);
    expect(await getProject(db, a.id)).toBeUndefined();
    expect(await listScenarios(db, a.id)).toEqual([]);
  });

  it('carreaux : tri par nom, suppression refusée s’ils sont utilisés', async () => {
    const db = await fresh();
    const t1 = createTile({ name: 'Zellige' }),
      t2 = createTile({ name: 'Ardoise' });
    await saveTile(db, t1);
    await saveTile(db, t2);
    expect((await listTiles(db)).map((t) => t.name)).toEqual(['Ardoise', 'Zellige']);
    await saveProject(db, createProject([createSurface(t1.id)]));
    expect(await deleteTile(db, t1.id)).toBe(false);
    expect(await deleteTile(db, t2.id)).toBe(true);
    expect((await listTiles(db)).map((t) => t.name)).toEqual(['Zellige']);
  });

  it('photos en Blob ; les orphelines sont supprimées', async () => {
    const db = await fresh();
    const kept = photo(),
      thumb = photo(),
      orphan = photo();
    for (const p of [kept, thumb, orphan]) await savePhoto(db, p);
    const t = createTile({ photoId: kept.id });
    await saveTile(db, t);
    const p = createProject([createSurface(t.id)]);
    await saveScenario(db, scenario(p, 'A', { thumbnailId: thumb.id }));
    expect(await collectPhotos(db)).toBe(1);
    const back = await getPhoto(db, kept.id);
    expect(back!.blob).toBeInstanceOf(Blob);
    expect(await back!.blob.text()).toBe('x');
    expect(await getPhoto(db, orphan.id)).toBeUndefined();
  });

  it('scénarios : un seul par emplacement', async () => {
    const db = await fresh();
    const p = createProject([createSurface(newId())]);
    await saveScenario(db, scenario(p, 'B'));
    await saveScenario(db, scenario(p, 'A', { name: 'premier' }));
    await saveScenario(db, scenario(p, 'A', { name: 'second' }));
    expect((await listScenarios(db, p.id)).map((s) => [s.slot, s.name])).toEqual([
      ['A', 'second'],
      ['B', 'Scénario B'],
    ]);
  });

  it('base v1 réelle : passe en v2 (magasin boards), documents migrés à la lecture puis réécrits', async () => {
    const name = 'test-' + newId();
    // schéma de la version 1 publiée (UPGRADES[0]), avec un projet et un scénario v1
    const old = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
        const tiles = db.createObjectStore('tiles', { keyPath: 'id' });
        tiles.createIndex('name', 'name');
        tiles.createIndex('updatedAt', 'updatedAt');
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('scenarios', { keyPath: 'id' }).createIndex('projectId', 'projectId');
        db.createObjectStore('prefs', { keyPath: 'key' });
      },
    });
    await old.put('projects', structuredClone(V1_ROOM));
    await old.put('scenarios', structuredClone(V1_SCENARIO));
    old.close();

    const db = await openDb(name);
    opened.push({ db, name });
    expect(db.version).toBe(2);
    expect(db.objectStoreNames.contains('boards')).toBe(true);
    expect(await listProjects(db)).toEqual([migrateProject(V1_ROOM).doc]);
    expect(await listScenarios(db, 'p-mur')).toEqual([migrateScenario(V1_SCENARIO).doc]);
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.get('projects', 'p-sdb')).toEqual(migrateProject(V1_ROOM).doc);
    expect((await db.get('scenarios', 'sc1'))!.schemaVersion).toBe(2);
  });

  it('préférences', async () => {
    const db = await fresh();
    expect(await getPref(db, 'theme')).toBeUndefined();
    await setPref(db, 'theme', 'dark');
    await setPref(db, 'palette', { tiles: ['#fff'], grouts: [] });
    expect(await getPref(db, 'theme')).toBe('dark');
    expect(await getPref(db, 'palette')).toEqual({ tiles: ['#fff'], grouts: [] });
  });

  it('refuse un document d’une version plus récente', async () => {
    const name = 'test-' + newId();
    const db = await openDb(name);
    opened.push({ db, name });
    const p = { ...createProject([]), schemaVersion: 99 };
    // écriture brute, sans le typage du dépôt
    const raw = await openDB(name);
    await raw.put('projects', p);
    raw.close();
    await expect(getProject(db, p.id)).rejects.toThrow(/version plus récente/);
  });
});
