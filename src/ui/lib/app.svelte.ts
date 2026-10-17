/**
 * État de la coquille : base IndexedDB, projets, bibliothèques, préférences, photos, workers de calcul.
 * L'état propre à chaque module vit dans le module (carrelage : bibliothèque, calculs, scénarios).
 * L'interface lit cet état et appelle ses méthodes ; aucun calcul métier ici (tout passe par le worker).
 */
import { DEFAULT_WALL_THICKNESS } from '../../core/plan/walls';
import type { Id, Palette, Photo, Project } from '../../state/model';
import { openDb, type Db } from '../../storage/db';
import * as repo from '../../storage/repo';
import { libraries as libraryDefs, modules } from '../../modules/registry';
import type { Libraries, LibraryDefinition, LibraryItem, ModuleId } from '../../modules/types';
import { migrate, type Step } from '../../storage/migrations';
import { background, brand } from '../brand';
import { upsertItem } from './library';
import { DEFAULT_PALETTE } from './palette';
import { createWorkerClient, type ComputeClient } from '../../workers/client';
import { router } from './router.svelte';
import { toast } from './toasts.svelte';
import { canUndo } from '../../state/undo';
import { templatesToSeed } from '../../state/seeding';

export const SAVE_FAILED =
  'Enregistrement impossible : stockage plein ou indisponible. Vos changements sont gardés ici ; réessayez.';
export const UNDO_STALE = 'Impossible d’annuler : le projet a été modifié depuis.';
export const WRITE_FAILED = 'Enregistrement impossible : stockage plein ou indisponible. Réessayez.';

export const CONFLICT =
  'Ce projet a été modifié dans un autre onglet. Rechargez pour voir ses changements : vos dernières modifications ici ne sont pas enregistrées.';

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
  /** Épaisseur des murs des nouvelles pièces, mm (cloison placo 72/48 par défaut). */
  wallThickness = $state(DEFAULT_WALL_THICKNESS);
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
  /** `updatedAt` de chaque projet tel que cet onglet l'a lu ou écrit en dernier (contrôle à l'écriture). */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private known = new Map<Id, number>();
  /** Projets modifiés ailleurs pendant qu'un éditeur les tient ouverts : plus d'écriture avant rechargement. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private conflicted = new Set<Id>();
  /** Écritures de projet, l'une après l'autre. */
  private writes: Promise<unknown> = Promise.resolve();
  private channel: BroadcastChannel | null = null;

  async init(): Promise<void> {
    try {
      this._db = await openDb();
      this.live = createWorkerClient();
      this.batch = createWorkerClient();
      // démarrage des modules (base ouverte) avant le chargement des projets
      for (const m of modules) await m.start?.(this.db);
      await this.reload();
      this.listen();
      this.theme = (await repo.getPref(this.db, 'theme')) ?? 'auto';
      this.palette = (await repo.getPref(this.db, 'palette')) ?? DEFAULT_PALETTE;
      this.showCutNumbers = (await repo.getPref(this.db, 'showCutNumbers')) ?? true;
      this.wallThickness = (await repo.getPref(this.db, 'wallThickness')) ?? DEFAULT_WALL_THICKNESS;
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
    this.projects = await repo.listProjects(this.db);
    for (const p of this.projects) this.known.set(p.id, p.updatedAt);
  }

  /** Les enregistrements des autres onglets arrivent ici (BroadcastChannel). */
  private listen(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('pilepoil-projects');
    this.channel.onmessage = (e: MessageEvent<{ type: 'saved' | 'deleted'; id: Id }>) => void this.onOtherTab(e.data);
  }

  /** Message « modifié ailleurs », une seule fois par projet ; les écritures de ce projet s'arrêtent. */
  private conflictNotice(id: Id): void {
    if (this.conflicted.has(id)) return;
    this.conflicted.add(id);
    toast(CONFLICT, { tone: 'error', timeout: null, action: { label: 'Recharger', run: () => location.reload() } });
  }

  private async onOtherTab({ type, id }: { type: 'saved' | 'deleted'; id: Id }): Promise<void> {
    if (type === 'deleted') {
      this.projects = this.projects.filter((x) => x.id !== id);
      this.known.delete(id);
      return;
    }
    const fresh = await repo.getProject(this.db, id);
    if (!fresh) return;
    this.projects = [fresh, ...this.projects.filter((x) => x.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt);
    // un éditeur de ce projet est ouvert ici : il garde sa copie, qui n'a plus le droit d'écraser l'autre
    const r = router.route;
    if ((r.name === 'plan' || r.name === 'module') && r.id === id) {
      this.conflictNotice(id);
    } else this.known.set(id, fresh.updatedAt);
  }

  /* ---------- projets ---------- */

  project(id: Id): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  /** Écritures mises en file ; refusée (message et plus d'écriture) si un autre onglet a modifié le projet. */
  saveProject(p: Project): Promise<void> {
    const run = this.writes.then(() => this.write(p));
    this.writes = run.catch(() => undefined);
    return run;
  }

  private async write(p: Project): Promise<void> {
    if (this.conflicted.has(p.id)) return;
    try {
      await repo.saveProject(this.db, p, this.known.get(p.id));
    } catch (e) {
      if (!(e instanceof repo.ConflictError)) throw e;
      this.conflictNotice(p.id);
      return;
    }
    this.known.set(p.id, p.updatedAt);
    this.channel?.postMessage({ type: 'saved', id: p.id });
    this.projects = [p, ...this.projects.filter((x) => x.id !== p.id)].sort((a, b) => b.updatedAt - a.updatedAt);
    await repo.setPref(this.db, 'lastProjectId', p.id);
  }

  /**
   * Enregistre ; en cas d'échec, le dit avec « Réessayer » et renvoie false (l'appelant garde la saisie et rend
   * la main). À utiliser partout hors des éditeurs (qui ont leur enregistrement différé).
   */
  async trySaveProject(p: Project): Promise<boolean> {
    try {
      await this.saveProject(p);
      return !this.conflicted.has(p.id);
    } catch {
      toast(SAVE_FAILED, {
        tone: 'error',
        timeout: null,
        action: { label: 'Réessayer', run: () => void this.trySaveProject(p) },
      });
      return false;
    }
  }

  /**
   * Écriture hors projet (bibliothèque, scénario) : en cas d'échec, le dit et propose de réessayer (la même
   * écriture). Renvoie true si elle a réussi du premier coup.
   */
  async tryWrite(run: () => Promise<unknown>, message = WRITE_FAILED): Promise<boolean> {
    try {
      await run();
      return true;
    } catch {
      toast(message, {
        tone: 'error',
        timeout: null,
        action: { label: 'Réessayer', run: () => void this.tryWrite(run, message) },
      });
      return false;
    }
  }

  /**
   * Annulation d'un changement enregistré hors d'un éditeur : rétablit `before` seulement si le projet est
   * encore `after` ; sinon le dit et n'écrase rien.
   */
  async restoreIfUnchanged(after: Project, before: Project): Promise<boolean> {
    if (!canUndo(after, this.project(after.id))) {
      toast(UNDO_STALE, { tone: 'error' });
      return false;
    }
    return this.trySaveProject({ ...before, updatedAt: Date.now() });
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
    return (await this.trySaveProject(copy)) ? copy : null;
  }

  /** Suppression écrite tout de suite ; « Annuler » réenregistre le projet. Les photos sont nettoyées après le délai. */
  async deleteProject(id: Id): Promise<void> {
    const p = this.project(id);
    if (!p) return;
    this.projects = this.projects.filter((x) => x.id !== id);
    await repo.deleteProject(this.db, id);
    this.known.delete(id);
    this.channel?.postMessage({ type: 'deleted', id });
    const timer = setTimeout(() => this.collectPhotos(), 6500);
    toast(`Projet « ${p.name} » supprimé.`, {
      action: {
        label: 'Annuler',
        run: () => {
          clearTimeout(timer);
          void this.trySaveProject(p);
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

  async setWallThickness(v: number): Promise<void> {
    if (!(v > 0)) return;
    this.wallThickness = v;
    await repo.setPref(this.db, 'wallThickness', v);
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

  /** Charge chaque bibliothèque déclarée par les modules ; pose chaque modèle type une seule fois. */
  private async loadLibraries(): Promise<void> {
    const legacy = (await repo.getPref(this.db, 'librarySeeded')) ?? [];
    let seeded: readonly string[] = (await repo.getPref(this.db, 'templatesSeeded')) ?? [];
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
      if (def.templates) {
        const templates = def.templates();
        const plan = templatesToSeed(
          def.id,
          templates.map((t) => t.id),
          { legacy, seeded },
        );
        for (const t of templates)
          if (plan.pose.includes(t.id) && !items.some((x) => x.id === t.id)) {
            await repo.putItem(this.db, store, t);
            items = upsertItem(items, t);
          }
        if (plan.seeded.length !== seeded.length) seededNow = true;
        seeded = plan.seeded;
      }
      next[def.id] = items;
    }
    if (seededNow) await repo.setPref(this.db, 'templatesSeeded', [...seeded]);
    this.libraries = next;
    this.libraryVersion++;
  }

  /** Fiche produit reçue du favori (#/import), en attente du formulaire « nouveau » de la bibliothèque `lib`. */
  private pendingSheet: { lib: string; text: string } | null = null;

  setPendingSheet(lib: string, text: string): void {
    this.pendingSheet = { lib, text };
  }

  /** La fiche en attente pour `lib`, une seule fois. */
  takePendingSheet(lib: string): string | null {
    const p = this.pendingSheet;
    if (!p || p.lib !== lib) return null;
    this.pendingSheet = null;
    return p.text;
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
    void this.tryWrite(() => repo.putItem(this.db, repo.libraryStore(def.store), stamped), SAVE_FAILED);
  }

  /** Nom du premier projet qui utilise ce produit, sinon null. */
  libraryItemUser(lib: string, id: Id): string | null {
    const def = libraryDefs.find((d) => d.id === lib);
    return this.projects.find((p) => def?.usedIn(p, id, this.libraries))?.name ?? null;
  }

  /** Supprime un produit de bibliothèque ; refusé s'il sert à un projet : renvoie alors le nom de ce projet. */
  removeLibraryItem(lib: string, id: Id): string | null {
    const def = libraryDefs.find((d) => d.id === lib);
    if (!def) return null;
    const user = this.libraryItemUser(lib, id);
    if (user) return user;
    this.libraries = { ...this.libraries, [lib]: (this.libraries[lib] ?? []).filter((x) => x.id !== id) };
    this.libraryVersion++;
    void this.tryWrite(async () => {
      await repo.deleteItem(this.db, repo.libraryStore(def.store), id);
      this.collectPhotos();
    }, SAVE_FAILED);
    return null;
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

/** Barre d'état : pétrole en clair, fond de l'application en sombre (identité, pwa/head-extrait.html). */
const THEME_COLORS = { light: brand.petrole, dark: background.dark };

export const app = new AppState();
