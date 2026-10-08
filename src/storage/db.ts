import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { LibraryItem } from '../modules/types';
import type { Photo, Pref, PrefKey, Project, Scenario, Tile } from '../state/model';

export interface CalepinageDB extends DBSchema {
  projects: { key: string; value: Project; indexes: { updatedAt: number } };
  tiles: { key: string; value: Tile; indexes: { name: string; updatedAt: number } };
  photos: { key: string; value: Photo };
  scenarios: { key: string; value: Scenario; indexes: { projectId: string } };
  prefs: { key: PrefKey; value: Pref };
  /** Bibliothèque de lames du parquet (le type précis arrive avec le module, P1). */
  boards: { key: string; value: LibraryItem; indexes: { name: string; updatedAt: number } };
}

export type Db = IDBPDatabase<CalepinageDB>;
type UpgradeTx = IDBPTransaction<CalepinageDB, StoreNames<CalepinageDB>[], 'versionchange'>;

export const DB_NAME = 'calepinage';

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
  return openDB<CalepinageDB>(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < DB_VERSION; v++) UPGRADES[v]!(db, tx);
    },
  });
}
