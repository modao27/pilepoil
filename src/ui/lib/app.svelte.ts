/**
 * État de la coquille : base IndexedDB, projets, bibliothèques, préférences, photos, workers de calcul.
 * L'état propre à chaque module vit dans le module (carrelage : bibliothèque, calculs, scénarios).
 * L'interface lit cet état et appelle ses méthodes ; aucun calcul métier ici (tout passe par le worker).
 */
import type { Id, Palette, Photo, Project } from '../../state/model';
import { openDb, type Db } from '../../storage/db';
import * as repo from '../../storage/repo';
import { libraries as libraryDefs, modules } from '../../modules/registry';
import type { Libraries, LibraryDefinition, LibraryItem, ModuleId } from '../../modules/types';
import { migrate, type Step } from '../../storage/migrations';
import { upsertItem } from './library';
import { DEFAULT_PALETTE } from './palette';
import { createWorkerClient, type ComputeClient } from '../../workers/client';
import { toast } from './toasts.svelte';

export type Theme = 'auto' | 'light' | 'dark';

export class AppState {
  ready = $state(false);
  fatal = $state<string | null>(null);
  // Données immuables, remplacées à chaque modification : $state.raw évite les proxys, que ni IndexedDB
  // ni postMessage ne savent cloner.
  projects = $state.raw<Project[]>([]);
  theme = $state<Theme>('auto');
  palette = $state.raw<Palette>(DEFAULT_PALETTE);
  showCutNumbers = $state(true);
  /** URL d'affichage des photos chargées (object URL). */
  photoUrls = $state.raw<Record<Id, string>>({});

  /** Bibliothèques chargées par les modules ('tiles'…), pour `toSpec` de chaque module. */
  libraries = $state.raw<Libraries>({});

  /** Aperçu en direct : seule la dernière demande de chaque module compte (docs/BOITE.md §6). */
  live!: ComputeClient;
  /** Vignettes et résumés : toutes les demandes, une à la fois. */
  private batch!: ComputeClient;
  private queue: Promise<unknown> = Promise.resolve();
  private _db!: Db;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private pendingDeletes = new Map<Id, ReturnType<typeof setTimeout>>();

  async init(): Promise<void> {
    try {
      this._db = await openDb();
      this.live = createWorkerClient();
      this.batch = createWorkerClient();
      // démarrage des modules (base ouverte) avant le chargement des projets
      for (const m of modules) await m.start?.(this.db);
      await this.reload();
      this.theme = (await repo.getPref(this.db, 'theme')) ?? 'auto';
      this.palette = (await repo.getPref(this.db, 'palette')) ?? DEFAULT_PALETTE;
      this.showCutNumbers = (await repo.getPref(this.db, 'showCutNumbers')) ?? true;
      applyTheme(this.theme);
      this.ready = true;
    } catch (e) {
      this.fatal =
        'Stockage indisponible : ouvrez l’application hors navigation privée, ou libérez de l’espace. (' +
        (e instanceof Error ? e.message : String(e)) +
        ')';
    }
  }

  /** Recharge bibliothèques et projets depuis la base (après un import, par exemple). */
  async reload(): Promise<void> {
    await this.loadLibraries();
    this.projects = (await repo.listProjects(this.db)).filter((p) => !this.pendingDeletes.has(p.id));
  }

  /* ---------- projets ---------- */

  project(id: Id): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  async saveProject(p: Project): Promise<void> {
    await repo.saveProject(this.db, p);
    this.projects = [p, ...this.projects.filter((x) => x.id !== p.id)].sort((a, b) => b.updatedAt - a.updatedAt);
    await repo.setPref(this.db, 'lastProjectId', p.id);
  }

  async duplicateProject(id: Id): Promise<Project | null> {
    const p = this.project(id);
    if (!p) return null;
    const now = Date.now();
    const copy: Project = {
      ...structuredClone(p),
      id: crypto.randomUUID(),
      name: p.name + ' (copie)',
      createdAt: now,
      updatedAt: now,
    };
    await this.saveProject(copy);
    return copy;
  }

  /** Suppression annulable pendant quelques secondes. */
  deleteProject(id: Id): void {
    const p = this.project(id);
    if (!p) return;
    this.projects = this.projects.filter((x) => x.id !== id);
    const timer = setTimeout(() => {
      this.pendingDeletes.delete(id);
      void repo.deleteProject(this.db, id).then(() => this.collectPhotos());
    }, 6500);
    this.pendingDeletes.set(id, timer);
    toast(`Projet « ${p.name} » supprimé.`, {
      action: {
        label: 'Annuler',
        run: () => {
          clearTimeout(timer);
          this.pendingDeletes.delete(id);
          this.projects = [p, ...this.projects].sort((a, b) => b.updatedAt - a.updatedAt);
        },
      },
    });
  }

  /* ---------- photos ---------- */

  async savePhoto(blob: Blob, width: number, height: number): Promise<Id> {
    const photo: Photo = { id: crypto.randomUUID(), blob, width, height, createdAt: Date.now() };
    await repo.savePhoto(this.db, photo);
    this.photoUrls = { ...this.photoUrls, [photo.id]: URL.createObjectURL(blob) };
    return photo.id;
  }

  /** Charge une photo (une fois) ; l'URL apparaît ensuite dans photoUrls. */
  loadPhoto(id: Id | null): void {
    if (!id || this.photoUrls[id]) return;
    void repo.getPhoto(this.db, id).then((p) => {
      if (p && !this.photoUrls[id]) this.photoUrls = { ...this.photoUrls, [id]: URL.createObjectURL(p.blob) };
    });
  }

  /** Supprime les photos devenues inutiles (gardées : bibliothèques et photos déclarées par les modules). */
  collectPhotos(): void {
    void Promise.all(modules.map((m) => m.usedPhotos?.(this.db) ?? Promise.resolve([]))).then((keep) =>
      repo.collectPhotos(this.db, keep.flat()),
    );
  }

  /* ---------- préférences et données ---------- */

  async setTheme(t: Theme): Promise<void> {
    this.theme = t;
    applyTheme(t);
    await repo.setPref(this.db, 'theme', t);
  }

  async setPalette(p: Palette): Promise<void> {
    this.palette = p;
    await repo.setPref(this.db, 'palette', p);
  }

  async setShowCutNumbers(v: boolean): Promise<void> {
    this.showCutNumbers = v;
    await repo.setPref(this.db, 'showCutNumbers', v);
  }

  /* ---------- calcul et bibliothèques ---------- */

  /** Calcul en file (vignettes, résumés) : toutes les demandes sont faites, l'une après l'autre. */
  queued<R>(module: ModuleId, spec: unknown): Promise<R> {
    const job = this.queue.then(() => this.batch.compute<R>(module, spec));
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Incrémenté à chaque modification d'une bibliothèque (clés de cache des calculs). */
  libraryVersion = 0;

  /** Charge chaque bibliothèque déclarée par les modules ; pose ses modèles types une seule fois. */
  private async loadLibraries(): Promise<void> {
    const seeded = [...((await repo.getPref(this.db, 'librarySeeded')) ?? [])];
    const next: Record<string, readonly LibraryItem[]> = {};
    let seededNow = false;
    for (const def of libraryDefs) {
      const store = repo.libraryStore(def.store);
      let items: readonly LibraryItem[] = [];
      for (const raw of await repo.listItems(this.db, store)) {
        const { doc, changed } = migrateItem(def, raw);
        if (changed) void repo.putItem(this.db, store, doc);
        items = upsertItem(items, doc);
      }
      if (def.templates && !seeded.includes(def.id)) {
        for (const t of def.templates())
          if (!items.some((x) => x.id === t.id)) {
            await repo.putItem(this.db, store, t);
            items = upsertItem(items, t);
          }
        seeded.push(def.id);
        seededNow = true;
      }
      next[def.id] = items;
    }
    if (seededNow) await repo.setPref(this.db, 'librarySeeded', seeded);
    this.libraries = next;
    this.libraryVersion++;
  }

  libraryItem<T extends LibraryItem>(lib: string, id: Id): T | undefined {
    return this.libraries[lib]?.find((x) => x.id === id) as T | undefined;
  }

  /** Ajoute ou remplace un élément (horodaté), trié par nom. */
  putLibraryItem(lib: string, item: LibraryItem): void {
    const def = libraryDefs.find((d) => d.id === lib);
    if (!def) return;
    const stamped = { ...item, updatedAt: Date.now() };
    this.libraries = { ...this.libraries, [lib]: upsertItem(this.libraries[lib] ?? [], stamped) };
    this.libraryVersion++;
    void repo.putItem(this.db, repo.libraryStore(def.store), stamped);
  }

  removeLibraryItem(lib: string, id: Id): void {
    const def = libraryDefs.find((d) => d.id === lib);
    if (!def) return;
    this.libraries = { ...this.libraries, [lib]: (this.libraries[lib] ?? []).filter((x) => x.id !== id) };
    this.libraryVersion++;
    void repo.deleteItem(this.db, repo.libraryStore(def.store), id).then(() => this.collectPhotos());
  }

  /** Base ouverte (modules). */
  get db(): Db {
    return this._db;
  }
}

function migrateItem(def: LibraryDefinition, raw: unknown): { doc: LibraryItem; changed: boolean } {
  const steps: Record<number, Step> = Object.fromEntries(
    Object.entries(def.migrations).map(([v, f]) => [
      v,
      (d: Record<string, unknown>) => f(d) as Record<string, unknown>,
    ]),
  );
  return migrate<LibraryItem>(raw, def.schemaVersion, steps);
}

function applyTheme(t: Theme) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  // barre d'état du téléphone (index.html : une couleur par mode système) ; thème forcé : même couleur partout
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light;
    meta.content = t === 'auto' ? own : THEME_COLORS[t];
  }
}

/** --paper clair et sombre (tokens.css). */
const THEME_COLORS = { light: '#e6ebee', dark: '#0e161b' };

export const app = new AppState();
