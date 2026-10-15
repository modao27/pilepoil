/**
 * État de l'éditeur des cloisons : projet (store + historique commun au projet), résultat du calcul (worker). Toutes les
 * modifications passent par des actions.
 */
import type { Project } from '../../../state/model';
import { reduceProject, type ProjectAction } from '../../../state/project';
import { createProjectStore, type ProjectStore } from '../../../state/store';
import { createSaver, type Saver } from '../../../storage/autosave';
import { app } from '../../../ui/lib/app.svelte';
import { toast } from '../../../ui/lib/toasts.svelte';
import { SupersededError } from '../../../workers/client';
import type { CloisonsResult, CloisonsSettings } from '../core/types';
import type { Action } from '../state/actions';
import { CLOISONS_ID, defaultPartitionSettings, type PartitionSettings } from '../state/model';
import { cloisonsData, systemsOf, toSpec } from '../state/spec';

export class CloisonsEditorState {
  doc = $state.raw<Project>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  result = $state.raw<CloisonsResult | null>(null);
  computing = $state(false);
  /** Le dernier calcul a échoué (erreur du moteur) : `result` est celui d'avant. */
  failed = $state(false);

  readonly store: ProjectStore<Project, ProjectAction>;
  private saver: Saver<Project>;

  data = $derived(cloisonsData(this.doc)!);
  systems = $derived(systemsOf(app.libraries));
  /** Entrée du moteur (null : rien à calculer, avec le code de l'erreur). */
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

  /** Calcul en direct dans le worker (seule la dernière demande compte). */
  async recompute(): Promise<void> {
    const r = this.spec;
    if ('errors' in r) {
      this.result = null;
      return;
    }
    this.computing = true;
    try {
      this.result = await app.live.compute<CloisonsResult>(CLOISONS_ID, r.spec);
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

  settingsOf(id: string): PartitionSettings {
    return this.data.partitions[id] ?? defaultPartitionSettings();
  }

  update(id: string, patch: Partial<PartitionSettings>, key?: string): void {
    this.dispatch({ type: 'cloisons/partition/update', partitionId: id, patch }, key);
  }

  /** Change de système : l'épaisseur de la cloison dans le plan suit, en une seule étape d'annulation. */
  setSystem(id: string, systemId: string): void {
    const system = this.systems.find((s) => s.id === systemId);
    if (!system) return;
    const setSystemSettings: Action = {
      type: 'cloisons/partition/update',
      partitionId: id,
      patch: { system: systemId },
    };
    this.dispatch({
      type: 'batch',
      actions: [
        { type: 'plan/partition/update', partitionId: id, patch: { thickness: system.thickness } },
        setSystemSettings,
      ],
    });
  }

  updateSettings(patch: Partial<CloisonsSettings>, key?: string): void {
    this.dispatch({ type: 'cloisons/settings/update', patch }, key);
  }
}
