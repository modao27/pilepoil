import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { LibraryItem } from '../modules/types';
import type { Photo, Pref, PrefKey, Project } from '../state/model';

/** Document d'un module rattaché à un projet (scénarios du carrelage) : typé par son module. */
export interface ProjectRecord {
  id: string;
  projectId: string;
}

export interface PilepoilDB extends DBSchema {
  projects: { key: string; value: Project; indexes: { updatedAt: number } };
  /** Bibliothèque de carreaux du carrelage (typée par le module). */
  tiles: { key: string; value: LibraryItem; indexes: { name: string; updatedAt: number } };
  photos: { key: string; value: Photo };
  /** Scénarios A/B du carrelage : supprimés avec leur projet. */
  scenarios: { key: string; value: ProjectRecord; indexes: { projectId: string } };
  prefs: { key: PrefKey; value: Pref };
  /** Bibliothèque de lames du parquet (le type précis arrive avec le module, P1). */
  boards: { key: string; value: LibraryItem; indexes: { name: string; updatedAt: number } };
}

export type Db = IDBPDatabase<PilepoilDB>;
type UpgradeTx = IDBPTransaction<PilepoilDB, StoreNames<PilepoilDB>[], 'versionchange'>;

export const DB_NAME = 'pilepoil';
/** Base de l'application avant son renommage en Pilepoil (S3) : copiée une fois, jamais modifiée. */
export const OLD_DB_NAME = 'calepinage';

/**
 * Montées de version du schéma de base : `UPGRADES[n]` passe de la version n à n + 1.
 * Ne jamais modifier une étape publiée : en ajouter une.
 */
const UPGRADES: ((db: Db, tx: UpgradeTx) => void)[] = [
  (db) => {
    db.createObjectStore('projects', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
    const tiles = db.createObjectStore('tiles', { keyPath: 'id' });
    tiles.createIndex('name', 'name');
    tiles.createIndex('updatedAt', 'updatedAt');
    db.createObjectStore('photos', { keyPath: 'id' });
    db.createObjectStore('scenarios', { keyPath: 'id' }).createIndex('projectId', 'projectId');
    db.createObjectStore('prefs', { keyPath: 'key' });
  },
  // v2 (S2) : bibliothèque de lames. Les projets passent en v2 à la lecture (migrations.ts).
  (db) => {
    const boards = db.createObjectStore('boards', { keyPath: 'id' });
    boards.createIndex('name', 'name');
    boards.createIndex('updatedAt', 'updatedAt');
  },
];

export const DB_VERSION = UPGRADES.length;

export function openDb(name = DB_NAME): Promise<Db> {
  return openDB<PilepoilDB>(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < DB_VERSION; v++) UPGRADES[v]!(db, tx);
    },
  });
}

export interface CopyResult {
  from: string;
  projects: number;
}

/**
 * Premier lancement sous le nom Pilepoil : copie une fois, magasin par magasin, la base de l'ancien nom si elle
 * existe (même origine : même appareil, même navigateur). L'ancienne base n'est jamais modifiée (filet de
 * sécurité). Les documents copiés gardent leur version et sont migrés à la lecture. Renvoie ce qui a été
 * copié, sinon null (déjà fait, ou rien à copier).
 */
export async function copyOldDb(db: Db, from = OLD_DB_NAME): Promise<CopyResult | null> {
  if (await db.get('prefs', 'copiedFrom')) return null;
  const exists =
    typeof indexedDB.databases === 'function' && (await indexedDB.databases()).some((d) => d.name === from);
  let result: CopyResult | null = null;
  if (exists) {
    // sans numéro de version : ouverte telle quelle, sans montée de version ni création de magasin
    const old = await openDB(from);
    try {
      for (const name of [...old.objectStoreNames]) {
        if (!db.objectStoreNames.contains(name as StoreNames<PilepoilDB>)) continue;
        const store = name as StoreNames<PilepoilDB>;
        const rows = await old.getAll(name);
        const tx = db.transaction(store, 'readwrite');
        for (const r of rows) await tx.store.put(r as never);
        await tx.done;
      }
      result = { from, projects: old.objectStoreNames.contains('projects') ? await old.count('projects') : 0 };
    } finally {
      old.close();
    }
  }
  await db.put('prefs', {
    key: 'copiedFrom',
    value: { from: result ? from : null, at: Date.now(), projects: result?.projects ?? 0 },
  });
  return result;
}
