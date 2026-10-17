/**
 * État de l'éditeur de la maçonnerie : projet (store + historique commun au projet), résultat du calcul (worker).
 * Toutes les modifications passent par des actions ; le premier mur active le module.
 */
import type { Project } from '../../../state/model';
import { reduceProject, type ProjectAction } from '../../../state/project';
import { createProjectStore, type ProjectStore } from '../../../state/store';
import { createSaver, type Saver } from '../../../storage/autosave';
import { app } from '../../../ui/lib/app.svelte';
import { toast } from '../../../ui/lib/toasts.svelte';
import { SupersededError } from '../../../workers/client';
import type { MaconnerieResult } from '../core/types';
import type { Action } from '../state/actions';
import {
  createMaconnerieData,
  MACONNERIE_ID,
  MACONNERIE_SCHEMA,
  type MaconnerieSettings,
  type MasonryWall,
} from '../state/model';
import { maconnerieData, materialsOf, toSpec } from '../state/spec';

export class MaconnerieEditorState {
  doc = $state.raw<Project>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  result = $state.raw<MaconnerieResult | null>(null);
  failed = $state(false);

  readonly store: ProjectStore<Project, ProjectAction>;
  private saver: Saver<Project>;

  data = $derived(maconnerieData(this.doc));
  materials = $derived(materialsOf(app.libraries));
  spec = $derived(toSpec(this.doc, app.libraries));

  constructor(p: Project) {
    this.saver = createSaver(
      (q) => app.saveProject(q),
      300,
      () => toast('Enregistrement impossible : stockage plein ou indisponible.', { tone: 'error' }),
    );
    this.store = createProjectStore(p, (q: Project, a: ProjectAction) => reduceProject(q, a), {
      onChange: (q) => this.saver.schedule(q),
    });
    this.store.subscribe((s) => {
      this.doc = s.project;
      this.canUndo = s.canUndo;
      this.canRedo = s.canRedo;
    });
  }

  flush(): Promise<void> {
    return this.saver.flush();
  }

  dispatch(a: Action | ProjectAction, key?: string): void {
    this.store.dispatch(a, key);
  }

  async recompute(): Promise<void> {
    const r = this.spec;
    if ('errors' in r) {
      this.result = null;
      return;
    }
    try {
      this.result = await app.live.compute<MaconnerieResult>(MACONNERIE_ID, r.spec);
      this.failed = false;
    } catch (e) {
      if (!(e instanceof SupersededError)) {
        this.failed = true;
        console.error(e);
      }
    }
  }

  /** Ajoute un mur (le premier active le module, dans la même étape d'annulation). */
  addWall(): void {
    const n = (this.data?.walls.length ?? 0) + 1;
    const wall: MasonryWall = {
      id: crypto.randomUUID(),
      name: `Mur ${n}`,
      length: 3000,
      height: 2500,
      material: this.materials[0]?.id ?? null,
      joint: null,
    };
    const add: Action = { type: 'maconnerie/wall/add', wall };
    if (this.data) return this.dispatch(add);
    const doc = { schemaVersion: MACONNERIE_SCHEMA, data: createMaconnerieData() };
    this.dispatch({ type: 'batch', actions: [{ type: 'project/module/add', id: MACONNERIE_ID, doc }, add] });
  }

  update(id: string, patch: Partial<Omit<MasonryWall, 'id'>>, key?: string): void {
    this.dispatch({ type: 'maconnerie/wall/update', id, patch }, key);
  }

  remove(id: string): void {
    this.dispatch({ type: 'maconnerie/wall/remove', id });
  }

  updateSettings(patch: Partial<MaconnerieSettings>, key?: string): void {
    this.dispatch({ type: 'maconnerie/settings/update', patch }, key);
  }
}
