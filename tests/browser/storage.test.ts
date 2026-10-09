import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { createTile, newId } from '../../src/modules/carrelage/state/factories';
import { wallOnly } from '../unit/planFixtures';
import { migrateProject } from '../../src/storage/migrations';
import { listScenarios, saveScenario, scenarioPhotos } from '../../src/modules/carrelage/storage/scenarios';
import { V1_ROOM, V1_SCENARIO } from '../unit/fixtures/v1';
import type { Photo, Project } from '../../src/state/model';
import type { Scenario, Tile } from '../../src/modules/carrelage/state/model';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { DB_NAME, DB_VERSION, openDb, type Db } from '../../src/storage/db';
import {
  collectPhotos,
  deleteProject,
  deleteItem,
  getPhoto,
  getPref,
  getProject,
  listProjects,
  listItems,
  libraryStore,
  putItem,
  saveProject,
  savePhoto,
  setPref,
} from '../../src/storage/repo';

/** Projet v2 avec le carrelage : un mur de 3 m × 2,4 m. */
const createProject = (tileId: string, o: Partial<Project> = {}, now = 0): Project => ({
  ...wallOnly({ tileId, tileUpright: false, pattern: 'half', angle: 0, joint: 3 }, 3000, 2400, now),
  ...o,
});

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
  schemaVersion: 3,
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
    const a = createProject(t.id, { name: 'A' }, 1000),
      b = createProject(t.id, { name: 'B' }, 2000);
    await saveProject(db, a);
    await saveProject(db, b);
    expect((await listProjects(db)).map((p) => p.name)).toEqual(['B', 'A']);
    expect(await getProject(db, a.id)).toEqual(a);
    await saveScenario(db, scenario(a, 'A'));
    await deleteProject(db, a.id);
    expect(await getProject(db, a.id)).toBeUndefined();
    expect(await listScenarios(db, a.id)).toEqual([]);
  });

  it('bibliothèques : carreaux et lames, magasins génériques', async () => {
    const db = await fresh();
    const t1 = createTile({ name: 'Zellige' }),
      t2 = createTile({ name: 'Ardoise' });
    await putItem(db, 'tiles', t1);
    await putItem(db, 'tiles', t2);
    await putItem(db, 'boards', BOARD_TEMPLATES[0]!);
    expect(((await listItems(db, 'tiles')) as Tile[]).map((t) => t.name).sort()).toEqual(['Ardoise', 'Zellige']);
    await deleteItem(db, 'tiles', t2.id);
    expect(((await listItems(db, 'tiles')) as Tile[]).map((t) => t.name)).toEqual(['Zellige']);
    expect(await listItems(db, 'boards')).toEqual([BOARD_TEMPLATES[0]]);
    expect(() => libraryStore('scenarios')).toThrow(/Magasin inconnu/);
  });

  it('photos en Blob ; les orphelines sont supprimées', async () => {
    const db = await fresh();
    const kept = photo(),
      thumb = photo(),
      orphan = photo();
    for (const p of [kept, thumb, orphan]) await savePhoto(db, p);
    const t = createTile({ photoId: kept.id });
    await putItem(db, 'tiles', t);
    const p = createProject(t.id);
    await saveScenario(db, scenario(p, 'A', { thumbnailId: thumb.id }));
    expect(await collectPhotos(db, await scenarioPhotos(db))).toBe(1);
    const back = await getPhoto(db, kept.id);
    expect(back!.blob).toBeInstanceOf(Blob);
    expect(await back!.blob.text()).toBe('x');
    expect(await getPhoto(db, orphan.id)).toBeUndefined();
  });

  it('scénarios : un seul par emplacement', async () => {
    const db = await fresh();
    const p = createProject(newId());
    await saveScenario(db, scenario(p, 'B'));
    await saveScenario(db, scenario(p, 'A', { name: 'premier' }));
    await saveScenario(db, scenario(p, 'A', { name: 'second' }));
    expect((await listScenarios(db, p.id)).map((s) => [s.slot, s.name])).toEqual([
      ['A', 'second'],
      ['B', 'Scénario B'],
    ]);
  });

  it('base v1 réelle : passe en v2 (magasin boards), projets migrés à la lecture, anciens scénarios supprimés', async () => {
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
    expect(await listScenarios(db, 'p-mur')).toEqual([]);
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.get('projects', 'p-sdb')).toEqual(migrateProject(V1_ROOM).doc);
    expect(await db.get('scenarios', 'sc1')).toBeUndefined();
  });

  it('nom de la base : pilepoil', () => {
    expect(DB_NAME).toBe('pilepoil');
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
    const p = { ...createProject(''), schemaVersion: 99 };
    // écriture brute, sans le typage du dépôt
    const raw = await openDB(name);
    await raw.put('projects', p);
    raw.close();
    await expect(getProject(db, p.id)).rejects.toThrow(/version plus récente/);
  });
});
