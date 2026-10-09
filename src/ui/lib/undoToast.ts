/**
 * Bouton « Annuler » d'un message après une modification dans un éditeur (plan, carrelage, parquet). Le message
 * peut survivre à l'éditeur : l'annulation ne défait le changement annoncé que s'il est encore le dernier état
 * du projet, dans l'éditeur comme en base ; sinon elle le dit et ne touche à rien.
 */
import type { Project } from '../../state/model';
import type { ProjectStore } from '../../state/store';
import { canUndo, latest } from '../../state/undo';
import { app, UNDO_STALE } from './app.svelte';
import { toast } from './toasts.svelte';

/** À appeler juste après le dispatch du changement annoncé. */
export function undoAction<A>(store: ProjectStore<Project, A>): { label: string; run: () => void } {
  const after = store.get().project;
  return {
    label: 'Annuler',
    run: () => {
      if (canUndo(after, latest(store.get().project, app.project(after.id)))) store.undo();
      else toast(UNDO_STALE, { tone: 'error' });
    },
  };
}
