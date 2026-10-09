import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { LibraryItem } from '../modules/types';
import { PROJECT_SCHEMA, type Photo, type Pref, type PrefKey, type Project } from '../state/model';

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
  // v2 (S2) : bibliothèque de lames.
  (db) => {
    const boards = db.createObjectStore('boards', { keyPath: 'id' });
    boards.createIndex('name', 'name');
    boards.createIndex('updatedAt', 'updatedAt');
  },
  // v3 (C4) : projets v1 (avant la boîte à outils) retirés, sans conversion ; bibliothèques, photos et
  // préférences gardées. Les anciens scénarios sont retirés à la lecture par le carrelage.
  (_db, tx) => void purge(tx, 'projects', 2),
  // v4 (N1) : zones et poses dans le projet ; projets précédents retirés, sans conversion.
  (_db, tx) => void purge(tx, 'projects', PROJECT_SCHEMA),
];

/** Supprime les documents d'un magasin dont le schéma est antérieur à `min`. */
async function purge(tx: UpgradeTx, store: 'projects', min: number): Promise<void> {
  let c = await tx.objectStore(store).openCursor();
  while (c) {
    if (((c.value as { schemaVersion?: number }).schemaVersion ?? 0) < min) await c.delete();
    c = await c.continue();
  }
}

export const DB_VERSION = UPGRADES.length;

export function openDb(name = DB_NAME): Promise<Db> {
  return openDB<PilepoilDB>(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < DB_VERSION; v++) UPGRADES[v]!(db, tx);
    },
  });
}
