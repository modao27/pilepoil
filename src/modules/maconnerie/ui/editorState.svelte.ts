/**
 * État de l'éditeur de la maçonnerie : projet (store + historique commun au projet), résultat du calcul (worker).
 * Toutes les modifications passent par des actions ; le premier mur saisi active le module.
 */
import type { Project } from '../../../state/model';
import { reduceProject, type ProjectAction } from '../../../state/project';
import { createProjectStore, type ProjectStore } from '../../../state/store';
import { createSaver, type Saver } from '../../../storage/autosave';
import { app } from '../../../ui/lib/app.svelte';
import { toast } from '../../../ui/lib/toasts.svelte';
import { SupersededError } from '../../../workers/client';
import { GLASS_BORDER } from '../core/compute';
import type { MaconnerieResult, Material } from '../core/types';
import type { Action, Target } from '../state/actions';
import {
  createMaconnerieData,
  MACONNERIE_ID,
  MACONNERIE_SCHEMA,
  type MaconnerieSettings,
  type MasonryWall,
  type WallZone,
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

  /** Ajoute un mur saisi (le premier active le module, dans la même étape d'annulation). */
  addWall(): void {
    const n = (this.data?.walls.length ?? 0) + 1;
    const wall: MasonryWall = {
      id: crypto.randomUUID(),
      name: `Mur ${n}`,
      length: 3000,
      height: 2500,
      material: this.materials[0]?.id ?? null,
      joint: null,
      zones: [],
    };
    const add: Action = { type: 'maconnerie/wall/add', wall };
    if (this.data) return this.dispatch(add);
    const doc = { schemaVersion: MACONNERIE_SCHEMA, data: createMaconnerieData() };
    this.dispatch({ type: 'batch', actions: [{ type: 'project/module/add', id: MACONNERIE_ID, doc }, add] });
  }

  updateWall(id: string, patch: Partial<Omit<MasonryWall, 'id' | 'zones'>>, key?: string): void {
    this.dispatch({ type: 'maconnerie/wall/update', id, patch }, key);
  }

  removeWall(id: string): void {
    this.dispatch({ type: 'maconnerie/wall/remove', id });
  }

  /** Matériau de base ; pour une cloison du plan, son épaisseur suit, en une seule étape d'annulation. */
  setBase(target: Target, material: string): void {
    const set: Action = { type: 'maconnerie/build/update', target, patch: { material, joint: null } };
    const m = this.materials.find((x) => x.id === material);
    if (!('partition' in target) || !m) return this.dispatch(set);
    this.dispatch({
      type: 'batch',
      actions: [
        { type: 'plan/partition/update', partitionId: target.partition, patch: { thickness: m.thickness } },
        set,
      ],
    });
  }

  setJoint(target: Target, joint: number): void {
    this.dispatch({ type: 'maconnerie/build/update', target, patch: { joint } });
  }

  /**
   * Nouvelle zone, centrée en largeur, à 1 m du sol si le mur le permet : briques de verre si la bibliothèque en a
   * (4 × 4 briques, bordures mini), sinon 1 × 1 m du premier matériau.
   */
  addZone(target: Target, length: number, height: number): void {
    const glass = this.materials.find((m) => !m.laying.cutAllowed);
    const m: Material | undefined = glass ?? this.materials[0];
    const side = (l: number, n: number) => n * l + (n - 1) * (m?.laying.jointH.def ?? 0) + 2 * GLASS_BORDER.min;
    const width = Math.min(length, glass ? side(glass.length, 4) : 1000);
    const h = Math.min(height, glass ? side(glass.height, 4) : 1000);
    const zone: WallZone = {
      id: crypto.randomUUID(),
      x: Math.round((length - width) / 2),
      y: Math.max(0, Math.min(1000, height - h)),
      width,
      height: h,
      material: m?.id ?? null,
      joint: null,
    };
    this.dispatch({ type: 'maconnerie/zone/add', target, zone });
  }

  updateZone(target: Target, id: string, patch: Partial<Omit<WallZone, 'id'>>, key?: string): void {
    this.dispatch({ type: 'maconnerie/zone/update', target, id, patch }, key);
  }

  removeZone(target: Target, id: string): void {
    this.dispatch({ type: 'maconnerie/zone/remove', target, id });
  }

  updateSettings(patch: Partial<MaconnerieSettings>, key?: string): void {
    this.dispatch({ type: 'maconnerie/settings/update', patch }, key);
  }
}
