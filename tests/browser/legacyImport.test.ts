import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { carrelageView } from '../../src/modules/carrelage/state/data';
import { newId } from '../../src/modules/carrelage/state/factories';
import { openDb, type Db } from '../../src/storage/db';
import { EMPTY_STORAGE } from '../../src/storage/legacy/convert';
import { autoImportLegacy, importLegacy } from '../../src/storage/legacy/import';
import { getPhoto, getPref, getProject, listProjects, listScenarios, listTiles } from '../../src/storage/repo';

/** Image PNG 2 × 1 réelle, pour vérifier la lecture des dimensions. */
async function png(): Promise<string> {
  const c = new OffscreenCanvas(2, 1);
  c.getContext('2d')!.fillRect(0, 0, 2, 1);
  const blob = await c.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return 'data:image/png;base64,' + btoa(String.fromCharCode(...bytes));
}

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

describe('import legacy en base', () => {
  it('écrit projet, carreaux, photos (Blob), scénarios, nuancier et marqueur', async () => {
    const db = await fresh();
    const img = await png();
    const store = {
      ...EMPTY_STORAGE,
      'calepinage-v3': JSON.stringify({ surfaces: [{ zones: [{ photo: 'p' }] }], active: 0, photos: { p: img } }),
      'calepinage-scenarios': JSON.stringify({ A: { state: { surfaces: [{}], active: 0 }, thumb: img } }),
      'calepinage-nuancier': JSON.stringify({ tiles: ['#fff'], grouts: ['#000'] }),
    };
    const sum = await importLegacy(db, store, 1234);
    expect(sum).toMatchObject({ surfaces: 1, tiles: 1, photos: 2, scenarios: 1, palette: true });
    const p = (await getProject(db, sum!.projectId!))!;
    const [tile] = await listTiles(db);
    expect(p.schemaVersion).toBe(2);
    expect(carrelageView(p)!.surfaces[0]!.zones[0]!.tileId).toBe(tile!.id);
    const photo = (await getPhoto(db, tile!.photoId!))!;
    expect(photo.blob.type).toBe('image/png');
    expect([photo.width, photo.height]).toEqual([2, 1]);
    expect(await listScenarios(db, p.id)).toHaveLength(1);
    expect(await getPref(db, 'palette')).toEqual({ tiles: ['#fff'], grouts: ['#000'] });
    expect(await getPref(db, 'legacyImport')).toEqual({ at: 1234, projectId: p.id });
    expect(await getPref(db, 'lastProjectId')).toBe(p.id);
  });

  it('import automatique : une seule fois, rien sans données legacy', async () => {
    const db = await fresh();
    const empty = { getItem: () => null };
    expect(await autoImportLegacy(db, empty)).toBeNull();
    expect(await getPref(db, 'legacyImport')).toBeUndefined();
    const ls = { getItem: (k: string) => (k === 'calepinage-v2' ? JSON.stringify({ zones: [{}] }) : null) };
    expect(await autoImportLegacy(db, ls)).not.toBeNull();
    expect(await autoImportLegacy(db, ls)).toBeNull();
    expect(await listProjects(db)).toHaveLength(1);
  });

  it('une photo illisible n’empêche pas l’import', async () => {
    const db = await fresh();
    const store = {
      ...EMPTY_STORAGE,
      'calepinage-v3': JSON.stringify({
        surfaces: [{ zones: [{ photo: 'p' }] }],
        active: 0,
        photos: { p: 'data:image/png;base64,%%%' },
      }),
    };
    const sum = await importLegacy(db, store);
    expect(sum).toMatchObject({ surfaces: 1, photos: 0 });
    expect((await listTiles(db))[0]!.photoId).toBeNull();
  });
});
