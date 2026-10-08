/**
 * État du module carrelage : bibliothèque de carreaux, calculs (worker), prix, scénarios A/B.
 * Les projets, préférences et photos restent dans l'état de la coquille (`app`).
 */
import type { Id, Project, Scenario, Tile } from '../../../state/model';
import { SCENARIO_SCHEMA } from '../../../state/model';
import type { Db } from '../../../storage/db';
import * as repo from '../../../storage/repo';
import { app } from '../../../ui/lib/app.svelte';
import { SupersededError } from '../../../workers/client';
import type {
  Metrics,
  OptimizeProgress,
  OptimizeResult,
  OptimizerGoal,
  ProjectResult,
  ProjectSpec,
  Settings,
  SurfaceSpec,
} from '../core';
import type { OptimizeSpec } from '../engine';
import { newId } from '../state/factories';
import { createLibraryStore, type LibraryStore } from '../state/library';
import { toProjectSpec, usedTileIds } from '../state/selectors';
import { carrelageData, carrelageView, withCarrelage, type CarrelageProject } from '../state/data';
import { reduceProject } from '../../../state/project';
import type { Action } from '../state/actions';

const MODULE = 'carrelage';

export class CarrelageState {
  // Données immuables, remplacées à chaque modification : $state.raw évite les proxys, que ni IndexedDB
  // ni postMessage ne savent cloner.
  tiles = $state.raw<readonly Tile[]>([]);

  private db!: Db;
  private library!: LibraryStore;
  // Caches internes, volontairement non réactifs (l'interface lit tiles, pas ces tables).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private cache = new Map<string, ProjectResult>();
  private tilesVersion = 0;

  /** (Re)charge la bibliothèque ; ouvre les workers au premier appel. */
  async load(db: Db): Promise<void> {
    this.db = db;
    const tiles = await repo.listTiles(db);
    this.library = createLibraryStore(tiles, {
      isUsed: (id) => app.projects.some((p) => uses(p, id)),
      onSave: (t) => void repo.saveTile(this.db, t),
      onDelete: (id) => void repo.deleteTile(this.db, id),
    });
    this.library.subscribe((t) => {
      this.tiles = t;
      app.setLibrary('tiles', t);
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
    const user = app.projects.find((p) => uses(p, id));
    if (user) return user.name;
    this.library.remove(id);
    return null;
  }

  /** Vue carrelage d'un projet enregistré ; undefined s'il n'existe pas ou n'a pas le carrelage. */
  view(projectId: Id): CarrelageProject | undefined {
    const p = app.project(projectId);
    return (p && carrelageView(p)) ?? undefined;
  }

  /* ---------- calcul ---------- */

  spec(p: CarrelageProject): ProjectSpec {
    return toProjectSpec(p, this.tiles).spec;
  }

  /** Calcul en direct (aperçu) : null si une demande plus récente l'a remplacé. */
  async computeLive(spec: ProjectSpec): Promise<ProjectResult | null> {
    try {
      return await app.live.compute<ProjectResult>(MODULE, spec);
    } catch (e) {
      if (e instanceof SupersededError) return null;
      throw e;
    }
  }

  /** Optimisation du départ dans le worker, avec progression et annulation. */
  optimize(
    surface: SurfaceSpec,
    zones: number[],
    goal: OptimizerGoal,
    settings: Settings,
    opts: { onProgress?: (p: OptimizeProgress) => void; signal?: AbortSignal } = {},
  ): Promise<OptimizeResult> {
    const spec: OptimizeSpec = { surface, zones, goal, settings };
    const onProgress = opts.onProgress;
    return app.live.optimize<OptimizeResult>(MODULE, spec, {
      signal: opts.signal,
      onProgress: onProgress && ((p) => onProgress({ zone: p.part ?? 0, percent: p.percent })),
    });
  }

  /** Résultat d'un projet enregistré, mis en cache tant que ni le projet ni la bibliothèque ne changent. */
  result(p: CarrelageProject): Promise<ProjectResult> {
    return this.cached(`${p.id}:${p.updatedAt}:${this.tilesVersion}`, () => this.spec(p));
  }

  /** Résultat d'un scénario : son projet figé avec ses propres carreaux. */
  scenarioResult(s: Scenario): Promise<ProjectResult> {
    return this.cached(
      `scenario:${s.id}:${s.createdAt}`,
      () => toProjectSpec(carrelageView(s.snapshot.project)!, s.snapshot.tiles).spec,
    );
  }

  private cached(key: string, spec: () => ProjectSpec): Promise<ProjectResult> {
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const sp = spec();
    return app.queued<ProjectResult>(MODULE, sp).then((r) => {
      this.cache.set(key, r);
      return r;
    });
  }

  /* ---------- prix ---------- */

  /** Prix unitaire saisi pour un article (null : effacer, revenir au prix du carreau s'il y en a un). */
  async setPrice(projectId: Id, key: string, value: number | null): Promise<void> {
    const p = app.project(projectId);
    if (!p) return;
    const price: Action = { type: 'carrelage/price', key, value };
    const next = reduceProject(p, price);
    if (next !== p) await app.saveProject({ ...next, updatedAt: Date.now() });
  }

  /* ---------- scénarios A/B ---------- */

  scenarios(projectId: Id): Promise<Scenario[]> {
    return repo.listScenarios(this.db, projectId);
  }

  /** Enregistre l'état actuel du projet dans l'emplacement A ou B (copie figée avec ses carreaux). */
  async saveScenario(p: Project, slot: 'A' | 'B', name: string, metrics: Metrics | null): Promise<Scenario> {
    const view = carrelageView(p);
    const used = view ? usedTileIds(view) : null;
    const s: Scenario = {
      schemaVersion: SCENARIO_SCHEMA,
      id: newId(),
      projectId: p.id,
      slot,
      name,
      snapshot: { project: structuredClone(p), tiles: structuredClone(this.tiles.filter((t) => !!used?.has(t.id))) },
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
   * Remet les données carrelage du projet dans l'état du scénario (surfaces, pièce, réglages, prix ; nom,
   * identité, plan et autres modules conservés).
   * Les carreaux du scénario absents de la bibliothèque y sont remis. Renvoie l'état remplacé (annulation).
   */
  async loadScenario(s: Scenario): Promise<Project | null> {
    const p = app.project(s.projectId);
    if (!p) return null;
    for (const t of s.snapshot.tiles) if (!this.tile(t.id)) this.putTile(t);
    const data = carrelageData(s.snapshot.project);
    if (data) await app.saveProject({ ...withCarrelage(p, data), updatedAt: Date.now() });
    return p;
  }

  /** Rétablit un projet tel quel (annulation d'un chargement de scénario). */
  async restoreProject(p: Project): Promise<void> {
    await app.saveProject({ ...p, updatedAt: Date.now() });
  }
}

/** Le projet utilise ce carreau (projets sans carrelage : non). */
function uses(p: Project, tileId: Id): boolean {
  const v = carrelageView(p);
  return !!v && usedTileIds(v).has(tileId);
}

export const carrelage = new CarrelageState();
