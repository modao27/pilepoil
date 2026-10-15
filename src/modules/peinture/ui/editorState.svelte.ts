/**
 * État de l'éditeur de peinture : projet (store + historique commun au projet), pose courante, résultat du
 * calcul (worker). Toutes les modifications passent par des actions.
 */
import type { Project } from '../../../state/model';
import { reduceProject, type ProjectAction } from '../../../state/project';
import { createProjectStore, type ProjectStore } from '../../../state/store';
import { createSaver, type Saver } from '../../../storage/autosave';
import { app } from '../../../ui/lib/app.svelte';
import { toast } from '../../../ui/lib/toasts.svelte';
import { SupersededError } from '../../../workers/client';
import type { Paint } from '../core/paint';
import type { PaintPoseSettings, PeintureResult, PeintureSpec, WoodworkSettings } from '../core/types';
import type { Action } from '../state/actions';
import { PEINTURE_ID } from '../state/model';
import { toSpec } from '../state/module';
import { layoutsOf, peintureData, type PaintLayout } from '../state/poses';

export class PeintureEditorState {
  doc = $state.raw<Project>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  result = $state.raw<PeintureResult | null>(null);
  /** Pose affichée dans les réglages (null : la première). */
  current = $state<string | null>(null);
  computing = $state(false);
  /** Le dernier calcul a échoué (erreur du moteur) : `result` est celui d'avant. */
  failed = $state(false);

  readonly store: ProjectStore<Project, ProjectAction>;
  private saver: Saver<Project>;

  data = $derived(peintureData(this.doc)!);
  layouts = $derived(layoutsOf(this.doc));
  layout = $derived<PaintLayout | undefined>(this.layouts.find((l) => l.id === this.current) ?? this.layouts[0]);
  paints = $derived((app.libraries.paints ?? []) as readonly Paint[]);
  /** Résultat de la pose affichée. */
  poseResult = $derived(this.result?.poses.find((p) => p.id === this.layout?.id)?.result ?? null);

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

  /** Calcul en direct dans le worker (seule la dernière demande compte). */
  async recompute(): Promise<void> {
    const r = toSpec(this.doc, app.libraries);
    if ('errors' in r) {
      this.result = null;
      return;
    }
    this.computing = true;
    try {
      this.result = await app.live.compute<PeintureResult>(PEINTURE_ID, r.spec satisfies PeintureSpec);
      this.failed = false;
    } catch (e) {
      if (!(e instanceof SupersededError)) {
        // résultat d'avant gardé, signalé comme tel (ComputeFailed)
        this.failed = true;
        console.error(e);
      }
    } finally {
      this.computing = false;
    }
  }

  update(patch: Partial<PaintPoseSettings>, key?: string): void {
    if (this.layout) this.dispatch({ type: 'peinture/pose/update', poseId: this.layout.id, patch }, key);
  }

  updateWoodwork(patch: Partial<WoodworkSettings>, key?: string): void {
    if (this.layout) this.update({ woodwork: { ...this.layout.settings.woodwork, ...patch } }, key);
  }
}
