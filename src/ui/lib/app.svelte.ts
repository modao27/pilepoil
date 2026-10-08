/**
 * État de la coquille : base IndexedDB, projets, préférences, photos, import legacy.
 * L'état propre à chaque module vit dans le module (carrelage : bibliothèque, calculs, scénarios).
 * L'interface lit cet état et appelle ses méthodes ; aucun calcul métier ici (tout passe par le worker).
 */
import { DEFAULT_PALETTE, newId, ui } from '../../modules/carrelage';
import type { Id, Palette, Photo, Project } from '../../state/model';
import { openDb, type Db } from '../../storage/db';
import { autoImportLegacy, importLegacy, parseLegacyExport, type ImportSummary } from '../../storage/legacy/import';
import * as repo from '../../storage/repo';
import type { Libraries, LibraryItem, ModuleId } from '../../modules/types';
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
    const { carrelage } = await ui.state();
    await carrelage.load(this.db);
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

  /* ---------- photos ---------- */

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

  /* ---------- calcul et bibliothèques ---------- */

  /** Calcul en file (vignettes, résumés) : toutes les demandes sont faites, l'une après l'autre. */
  queued<R>(module: ModuleId, spec: unknown): Promise<R> {
    const job = this.queue.then(() => this.batch.compute<R>(module, spec));
    this.queue = job.catch(() => undefined);
    return job;
  }

  setLibrary(id: string, items: readonly LibraryItem[]): void {
    this.libraries = { ...this.libraries, [id]: items };
  }

  /** Base ouverte (modules). */
  get db(): Db {
    return this._db;
  }
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

function importMessage(s: ImportSummary): string {
  const parts = [`${s.surfaces} surface${s.surfaces > 1 ? 's' : ''}`, `${s.tiles} carreau${s.tiles > 1 ? 'x' : ''}`];
  if (s.scenarios) parts.push(`${s.scenarios} scénario${s.scenarios > 1 ? 's' : ''}`);
  return `Projet de l’ancienne version importé : ${parts.join(', ')}.`;
}

export const app = new AppState();
