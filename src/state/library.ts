import type { Id, Tile } from './model';

/** Bibliothèque de carreaux : store séparé, hors historique des projets. */
export interface LibraryStore {
  subscribe(run: (tiles: readonly Tile[]) => void): () => void;
  get(): readonly Tile[];
  /** Ajoute ou remplace un carreau (horodaté). */
  put(tile: Tile): void;
  update(id: Id, patch: Partial<Omit<Tile, 'id' | 'schemaVersion' | 'createdAt'>>): void;
  /** Supprime si aucun projet ne l'utilise ; renvoie false sinon. */
  remove(id: Id): boolean;
}

export interface LibraryOptions {
  isUsed: (id: Id) => boolean;
  onSave?: (t: Tile) => void;
  onDelete?: (id: Id) => void;
  now?: () => number;
}

const byName = (a: Tile, b: Tile) => a.name.localeCompare(b.name, 'fr');

export function createLibraryStore(initial: readonly Tile[], opts: LibraryOptions): LibraryStore {
  const now = opts.now ?? Date.now;
  let tiles: readonly Tile[] = [...initial].sort(byName);
  const subs = new Set<(t: readonly Tile[]) => void>();
  const set = (next: readonly Tile[]) => {
    tiles = next;
    subs.forEach((f) => f(tiles));
  };
  const put = (t: Tile) => {
    const stamped = { ...t, updatedAt: now() };
    set([...tiles.filter((x) => x.id !== t.id), stamped].sort(byName));
    opts.onSave?.(stamped);
  };
  return {
    subscribe(run) {
      subs.add(run);
      run(tiles);
      return () => subs.delete(run);
    },
    get: () => tiles,
    put,
    update(id, patch) {
      const t = tiles.find((x) => x.id === id);
      if (t) put({ ...t, ...patch });
    },
    remove(id) {
      if (opts.isUsed(id)) return false;
      if (!tiles.some((x) => x.id === id)) return true;
      set(tiles.filter((x) => x.id !== id));
      opts.onDelete?.(id);
      return true;
    },
  };
}
