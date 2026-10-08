import { reduce, type Action } from './actions';
import { initHistory, record, redo, undo, type History } from './history';
import type { Project } from './model';

export interface ProjectState {
  project: Project;
  canUndo: boolean;
  canRedo: boolean;
}

export interface ProjectStore {
  /** Contrat des stores Svelte : appelle `run` tout de suite puis à chaque changement. */
  subscribe(run: (s: ProjectState) => void): () => void;
  get(): ProjectState;
  /** coalesceKey : actions d'un même geste fusionnées en une étape (voir history.ts). */
  dispatch(action: Action, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  /** Remplace le projet et vide l'historique (ouverture d'un autre projet). */
  reset(project: Project): void;
}

export interface StoreOptions {
  /** Appelé après chaque modification du projet (enregistrement). */
  onChange?: (p: Project) => void;
  now?: () => number;
}

export function createProjectStore(initial: Project, opts: StoreOptions = {}): ProjectStore {
  const now = opts.now ?? Date.now;
  let h: History<Project> = initHistory(initial);
  const subs = new Set<(s: ProjectState) => void>();
  const state = (): ProjectState => ({ project: h.present, canUndo: h.past.length > 0, canRedo: h.future.length > 0 });
  const set = (next: History<Project>, changed: boolean) => {
    if (next === h) return;
    h = next;
    const s = state();
    subs.forEach((f) => f(s));
    if (changed) opts.onChange?.(h.present);
  };
  return {
    subscribe(run) {
      subs.add(run);
      run(state());
      return () => subs.delete(run);
    },
    get: state,
    dispatch(action, coalesceKey) {
      const t = now();
      const next = reduce(h.present, action);
      if (next === h.present) return;
      set(record(h, { ...next, updatedAt: t }, coalesceKey ?? null, t), true);
    },
    undo: () => set(undo(h), true),
    redo: () => set(redo(h), true),
    reset: (p) => set(initHistory(p), false),
  };
}
