/**
 * État du module carrelage : bibliothèque de carreaux, calculs (worker), prix, scénarios A/B.
 * Les projets, préférences et photos restent dans l'état de la coquille (`app`).
 */
import type { Id, Project, Scenario, Tile } from '../../../state/model';
import { SCENARIO_SCHEMA } from '../../../state/model';
import type { Db } from '../../../storage/db';
import * as repo from '../../../storage/repo';
import { app } from '../../../ui/lib/app.svelte';
import { createWorkerClient, SupersededError, type ComputeClient } from '../../../workers/client';
import type { Metrics, ProjectResult, ProjectSpec } from '../core';
import { reduce } from '../state/actions';
import { newId } from '../state/factories';
import { createLibraryStore, type LibraryStore } from '../state/library';
import { toProjectSpec, usedTileIds } from '../state/selectors';

export class CarrelageState {
  // Données immuables, remplacées à chaque modification : $state.raw évite les proxys, que ni IndexedDB
  // ni postMessage ne savent cloner.
  tiles = $state.raw<readonly Tile[]>([]);

  private db!: Db;
  private library!: LibraryStore;
  /** Aperçu en direct : seule la dernière demande compte. */
  private live!: ComputeClient;
  /** Vignettes : toutes les demandes, une à la fois. */
  private batch!: ComputeClient;
  private queue: Promise<unknown> = Promise.resolve();
  // Caches internes, volontairement non réactifs (l'interface lit tiles, pas ces tables).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private cache = new Map<string, ProjectResult>();
  private tilesVersion = 0;

  /** (Re)charge la bibliothèque ; ouvre les workers au premier appel. */
  async load(db: Db): Promise<void> {
    this.db = db;
    this.live ??= createWorkerClient();
    this.batch ??= createWorkerClient();
    const tiles = await repo.listTiles(db);
    this.library = createLibraryStore(tiles, {
      isUsed: (id) => app.projects.some((p) => usedTileIds(p).has(id)),
      onSave: (t) => void repo.saveTile(this.db, t),
      onDelete: (id) => void repo.deleteTile(this.db, id),
    });
    this.library.subscribe((t) => {
      this.tiles = t;
      this.tilesVersion++;
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
    const user = app.projects.find((p) => usedTileIds(p).has(id));
    if (user) return user.name;
    this.library.remove(id);
    return null;
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
    return this.cached(`${p.id}:${p.updatedAt}:${this.tilesVersion}`, () => this.spec(p));
  }

  /** Résultat d'un scénario : son projet figé avec ses propres carreaux. */
  scenarioResult(s: Scenario): Promise<ProjectResult> {
    return this.cached(
      `scenario:${s.id}:${s.createdAt}`,
      () => toProjectSpec(s.snapshot.project, s.snapshot.tiles).spec,
    );
  }

  private cached(key: string, spec: () => ProjectSpec): Promise<ProjectResult> {
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const sp = spec();
    const job = this.queue.then(() => this.batch.compute(sp));
    this.queue = job.catch(() => undefined);
    return job.then((r) => {
      this.cache.set(key, r);
      return r;
    });
  }

  /* ---------- prix ---------- */

  /** Prix unitaire saisi pour un article (null : effacer, revenir au prix du carreau s'il y en a un). */
  async setPrice(projectId: Id, key: string, value: number | null): Promise<void> {
    const p = app.project(projectId);
    if (!p) return;
    const next = reduce(p, { type: 'project/price', key, value });
    if (next !== p) await app.saveProject({ ...next, updatedAt: Date.now() });
  }

  /* ---------- scénarios A/B ---------- */

  scenarios(projectId: Id): Promise<Scenario[]> {
    return repo.listScenarios(this.db, projectId);
  }

  /** Enregistre l'état actuel du projet dans l'emplacement A ou B (copie figée avec ses carreaux). */
  async saveScenario(p: Project, slot: 'A' | 'B', name: string, metrics: Metrics | null): Promise<Scenario> {
    const used = usedTileIds(p);
    const s: Scenario = {
      schemaVersion: SCENARIO_SCHEMA,
      id: newId(),
      projectId: p.id,
      slot,
      name,
      snapshot: { project: structuredClone(p), tiles: structuredClone(this.tiles.filter((t) => used.has(t.id))) },
      metrics,
      thumbnailId: null,
      createdAt: Date.now(),
    };
    await repo.saveScenario(this.db, s);
    return s;
  }

  async renameScenario(s: Scenario, name: string): Promise<void> {
    await repo.saveScenario(this.db, { ...s, name });
  }

  async deleteScenario(s: Scenario): Promise<void> {
    await repo.deleteScenario(this.db, s.id);
  }

  /**
   * Remet le projet dans l'état du scénario (surfaces, pièce, réglages, prix ; nom et identité conservés).
   * Les carreaux du scénario absents de la bibliothèque y sont remis. Renvoie l'état remplacé (annulation).
   */
  async loadScenario(s: Scenario): Promise<Project | null> {
    const p = app.project(s.projectId);
    if (!p) return null;
    for (const t of s.snapshot.tiles) if (!this.tile(t.id)) this.putTile(t);
    const snap = s.snapshot.project;
    await app.saveProject({
      ...p,
      surfaces: snap.surfaces,
      room: snap.room,
      settings: snap.settings,
      prices: snap.prices,
      updatedAt: Date.now(),
    });
    return p;
  }

  /** Rétablit un projet tel quel (annulation d'un chargement de scénario). */
  async restoreProject(p: Project): Promise<void> {
    await app.saveProject({ ...p, updatedAt: Date.now() });
  }
}

export const carrelage = new CarrelageState();
