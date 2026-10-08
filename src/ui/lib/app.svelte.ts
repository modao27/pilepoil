/**
 * État global de l'application : base IndexedDB, bibliothèque, projets, préférences, calcul.
 * L'interface lit cet état et appelle ses méthodes ; aucun calcul métier ici (tout passe par le worker).
 */
import type { ProjectResult, ProjectSpec } from '../../core';
import { DEFAULT_PALETTE, newId } from '../../state/factories';
import { createLibraryStore, type LibraryStore } from '../../state/library';
import type { Id, Palette, Photo, Project, Tile } from '../../state/model';
import { toProjectSpec, usedTileIds } from '../../state/selectors';
import { openDb, type Db } from '../../storage/db';
import { autoImportLegacy, importLegacy, parseLegacyExport, type ImportSummary } from '../../storage/legacy/import';
import * as repo from '../../storage/repo';
import { createWorkerClient, SupersededError, type ComputeClient } from '../../workers/client';
import { toast } from './toasts.svelte';

export type Theme = 'auto' | 'light' | 'dark';

export class AppState {
  ready = $state(false);
  fatal = $state<string | null>(null);
  // Données immuables, remplacées à chaque modification : $state.raw évite les proxys, que ni IndexedDB
  // ni postMessage ne savent cloner.
  tiles = $state.raw<readonly Tile[]>([]);
  projects = $state.raw<Project[]>([]);
  theme = $state<Theme>('auto');
  palette = $state.raw<Palette>(DEFAULT_PALETTE);
  showCutNumbers = $state(true);
  /** URL d'affichage des photos chargées (object URL). */
  photoUrls = $state.raw<Record<Id, string>>({});

  private db!: Db;
  private library!: LibraryStore;
  /** Aperçu en direct : seule la dernière demande compte. */
  private live!: ComputeClient;
  /** Vignettes : toutes les demandes, une à la fois. */
  private batch!: ComputeClient;
  private queue: Promise<unknown> = Promise.resolve();
  // Caches internes, volontairement non réactifs (l'interface lit projects / tiles, pas ces tables).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private cache = new Map<string, ProjectResult>();
  private tilesVersion = 0;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private pendingDeletes = new Map<Id, ReturnType<typeof setTimeout>>();

  async init(): Promise<void> {
    try {
      this.db = await openDb();
      this.live = createWorkerClient();
      this.batch = createWorkerClient();
      let imported: ImportSummary | null = null;
      try {
        imported = await autoImportLegacy(this.db, localStorage);
      } catch {
        // stockage legacy illisible : on continue sans import
      }
      await this.reload();
      this.theme = (await repo.getPref(this.db, 'theme')) ?? 'auto';
      this.palette = (await repo.getPref(this.db, 'palette')) ?? DEFAULT_PALETTE;
      this.showCutNumbers = (await repo.getPref(this.db, 'showCutNumbers')) ?? true;
      applyTheme(this.theme);
      this.ready = true;
      if (imported?.projectId) toast(importMessage(imported));
    } catch (e) {
      this.fatal =
        'Stockage indisponible : ouvrez l’application hors navigation privée, ou libérez de l’espace. (' +
        (e instanceof Error ? e.message : String(e)) +
        ')';
    }
  }

  private async reload() {
    const tiles = await repo.listTiles(this.db);
    this.library = createLibraryStore(tiles, {
      isUsed: (id) => this.projects.some((p) => usedTileIds(p).has(id)),
      onSave: (t) => void repo.saveTile(this.db, t),
      onDelete: (id) => void repo.deleteTile(this.db, id),
    });
    this.library.subscribe((t) => {
      this.tiles = t;
      this.tilesVersion++;
    });
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
      id: newId(),
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
      void repo.deleteProject(this.db, id);
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

  /* ---------- bibliothèque ---------- */

  tile(id: Id): Tile | undefined {
    return this.tiles.find((t) => t.id === id);
  }

  putTile(t: Tile): void {
    this.library.put(t);
  }

  /** null si supprimé, sinon le nom d'un projet qui l'utilise. */
  deleteTile(id: Id): string | null {
    const user = this.projects.find((p) => usedTileIds(p).has(id));
    if (user) return user.name;
    this.library.remove(id);
    return null;
  }

  async savePhoto(blob: Blob, width: number, height: number): Promise<Id> {
    const photo: Photo = { id: newId(), blob, width, height, createdAt: Date.now() };
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

  collectPhotos(): void {
    void repo.collectPhotos(this.db);
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

  async importLegacyFile(file: File): Promise<string> {
    const store = parseLegacyExport(await file.text());
    const sum = await importLegacy(this.db, store);
    await this.reload();
    return sum ? importMessage(sum) : 'Ce fichier ne contient aucun projet.';
  }

  /* ---------- calcul ---------- */

  spec(p: Project): ProjectSpec {
    return toProjectSpec(p, this.tiles).spec;
  }

  /** Calcul en direct (aperçu) : null si une demande plus récente l'a remplacé. */
  async computeLive(spec: ProjectSpec): Promise<ProjectResult | null> {
    try {
      return await this.live.compute(spec);
    } catch (e) {
      if (e instanceof SupersededError) return null;
      throw e;
    }
  }

  /** Optimisation du départ dans le worker, avec progression et annulation. */
  optimize(...args: Parameters<ComputeClient['optimize']>): ReturnType<ComputeClient['optimize']> {
    return this.live.optimize(...args);
  }

  /** Résultat d'un projet enregistré, mis en cache tant que ni le projet ni la bibliothèque ne changent. */
  result(p: Project): Promise<ProjectResult> {
    const key = `${p.id}:${p.updatedAt}:${this.tilesVersion}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const spec = this.spec(p);
    const job = this.queue.then(() => this.batch.compute(spec));
    this.queue = job.catch(() => undefined);
    return job.then((r) => {
      this.cache.set(key, r);
      return r;
    });
  }
}

function applyTheme(t: Theme) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function importMessage(s: ImportSummary): string {
  const parts = [`${s.surfaces} surface${s.surfaces > 1 ? 's' : ''}`, `${s.tiles} carreau${s.tiles > 1 ? 'x' : ''}`];
  if (s.scenarios) parts.push(`${s.scenarios} scénario${s.scenarios > 1 ? 's' : ''}`);
  return `Projet de l’ancienne version importé : ${parts.join(', ')}.`;
}

export const app = new AppState();
