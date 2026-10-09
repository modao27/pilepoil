/**
 * État du module carrelage : bibliothèque de carreaux, calculs (worker), prix, scénarios A/B.
 * Les projets, préférences et photos restent dans l'état de la coquille (`app`).
 */
import type { Id, Project } from '../../../state/model';
import type { Scenario, Tile } from '../state/model';
import { SCENARIO_SCHEMA } from '../state/model';
import type { Db } from '../../../storage/db';
import { deleteScenario, listScenarios, saveScenario } from '../storage/scenarios';
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
import { toProjectSpec, usedTileIds } from '../state/selectors';
import { carrelageView, type CarrelageProject } from '../state/data';
import { restoreTiling } from '../state/poses';
import { coverageText } from '../../../ui/lib/coverageMessages';
import { toast } from '../../../ui/lib/toasts.svelte';
import { reduceProject } from '../../../state/project';
import type { Action } from '../state/actions';

const MODULE = 'carrelage';
const TILES = 'tiles';
const SCENARIO_FAILED = 'Scénario non enregistré : stockage plein ou indisponible. Réessayez.';

export class CarrelageState {
  private db!: Db;
  // Cache interne, volontairement non réactif (l'interface lit les projets et la bibliothèque, pas cette table).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private cache = new Map<string, ProjectResult>();

  /** Démarrage : base ouverte, pour les scénarios. */
  async start(db: Db): Promise<void> {
    this.db = db;
  }

  /** Bibliothèque de carreaux, tenue par la coquille (`app.libraries.tiles`). */
  get tiles(): readonly Tile[] {
    return (app.libraries[TILES] ?? []) as readonly Tile[];
  }

  /* ---------- bibliothèque ---------- */

  tile(id: Id): Tile | undefined {
    return this.tiles.find((t) => t.id === id);
  }

  putTile(t: Tile): void {
    app.putLibraryItem(TILES, t);
  }

  /** null si supprimé, sinon le nom d'un projet qui l'utilise. */
  deleteTile(id: Id): string | null {
    const user = app.projects.find((p) => uses(p, id));
    if (user) return user.name;
    app.removeLibraryItem(TILES, id);
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
    return this.cached(`${p.id}:${p.updatedAt}:${app.libraryVersion}`, () => this.spec(p));
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
    if (next !== p) await app.trySaveProject({ ...next, updatedAt: Date.now() });
  }

  /* ---------- scénarios A/B ---------- */

  scenarios(projectId: Id): Promise<Scenario[]> {
    return listScenarios(this.db, projectId);
  }

  /**
   * Enregistre l'état actuel du projet dans l'emplacement A ou B (copie figée avec ses carreaux). false : échec
   * signalé, avec « Réessayer ».
   */
  async saveScenario(p: Project, slot: 'A' | 'B', name: string, metrics: Metrics | null): Promise<boolean> {
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
    return app.tryWrite(async () => {
      if (await saveScenario(this.db, s)) app.collectPhotos();
    }, SCENARIO_FAILED);
  }

  renameScenario(s: Scenario, name: string): Promise<boolean> {
    return app.tryWrite(() => saveScenario(this.db, { ...s, name }), SCENARIO_FAILED);
  }

  deleteScenario(s: Scenario): Promise<boolean> {
    return app.tryWrite(async () => {
      await deleteScenario(this.db, s.id);
      app.collectPhotos();
    }, SCENARIO_FAILED);
  }

  /**
   * Remet le carrelage du projet dans l'état du scénario (poses, zones, réglages, prix ; nom, identité, plan et
   * autres revêtements conservés).
   * Les carreaux du scénario absents de la bibliothèque y sont remis. Renvoie l'état d'avant et d'après (pour
   * l'annulation), null si rien n'a été enregistré.
   */
  async loadScenario(s: Scenario): Promise<{ before: Project; after: Project } | null> {
    const p = app.project(s.projectId);
    if (!p) return null;
    const restored = restoreTiling(p, s.snapshot.project);
    if ('code' in restored) {
      toast(`Scénario non chargé : ${coverageText(restored)}`, { tone: 'error' });
      return null;
    }
    for (const t of s.snapshot.tiles) if (!this.tile(t.id)) this.putTile(t);
    const after = { ...restored, updatedAt: Date.now() };
    return (await app.trySaveProject(after)) ? { before: p, after } : null;
  }
}

/** Le projet utilise ce carreau (projets sans carrelage : non). */
function uses(p: Project, tileId: Id): boolean {
  const v = carrelageView(p);
  return !!v && usedTileIds(v).has(tileId);
}

export const carrelage = new CarrelageState();
