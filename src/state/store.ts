import { initHistory, record, redo, undo, type History } from './history';

/** Document suivi par le store : seule la date de modification lui est connue. */
export interface Doc {
  updatedAt: number;
}

/** Réducteur pur : renvoie le document d'origine si l'action ne change rien. */
export type Reducer<D, A> = (doc: D, action: A) => D;

export interface ProjectState<D extends Doc> {
  project: D;
  canUndo: boolean;
  canRedo: boolean;
}

export interface ProjectStore<D extends Doc, A> {
  /** Contrat des stores Svelte : appelle `run` tout de suite puis à chaque changement. */
  subscribe(run: (s: ProjectState<D>) => void): () => void;
  get(): ProjectState<D>;
  /** coalesceKey : actions d'un même geste fusionnées en une étape (voir history.ts). */
  dispatch(action: A, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  /** Remplace le projet et vide l'historique (ouverture d'un autre projet). */
  reset(project: D): void;
}

export interface StoreOptions<D extends Doc> {
  /** Appelé après chaque modification du projet (enregistrement). */
  onChange?: (p: D) => void;
  now?: () => number;
}

export function createProjectStore<D extends Doc, A>(
  initial: D,
  reduce: Reducer<D, A>,
  opts: StoreOptions<D> = {},
): ProjectStore<D, A> {
  const now = opts.now ?? Date.now;
  let h: History<D> = initHistory(initial);
  const subs = new Set<(s: ProjectState<D>) => void>();
  const state = (): ProjectState<D> => ({
    project: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  });
  const set = (next: History<D>, changed: boolean) => {
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
