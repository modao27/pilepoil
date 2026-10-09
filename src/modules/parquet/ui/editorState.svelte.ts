/**
 * État de l'éditeur du parquet : projet (store + historique commun au projet), pose courante, résultat du
 * calcul (worker). Toutes les modifications passent par des actions.
 */
import type { Segment } from '../../../core/geometry/types';
import type { Project } from '../../../state/model';
import { reduceProject, type ProjectAction } from '../../../state/project';
import { createProjectStore, type ProjectStore } from '../../../state/store';
import { createSaver, type Saver } from '../../../storage/autosave';
import { app } from '../../../ui/lib/app.svelte';
import { toast } from '../../../ui/lib/toasts.svelte';
import { undoAction } from '../../../ui/lib/undoToast';
import { SupersededError } from '../../../workers/client';
import type { Board } from '../core/board';
import { METHOD_BY_KIND, RULES_BY_KIND } from '../core/defaults';
import type { OptimizeResult, OptimizeSpec } from '../core/optimize';
import type { Accessories, ParquetResult, ParquetSpec } from '../core/types';
import type { Action } from '../state/actions';
import { createLayout, PARQUET_ID, type Layout } from '../state/model';
import { parquetData, toSpec } from '../state/module';

export class ParquetEditorState {
  doc = $state.raw<Project>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  result = $state.raw<ParquetResult | null>(null);
  /** Pièce touchée sur le plan (infos de coupe). */
  selected = $state<string | null>(null);
  /** Pose affichée dans les réglages (null : la première). */
  current = $state<string | null>(null);
  computing = $state(false);
  /** Optimisation du départ en cours : avancement en %. */
  optimizing = $state<number | null>(null);
  private abort: AbortController | null = null;

  readonly store: ProjectStore<Project, ProjectAction>;
  private saver: Saver<Project>;

  data = $derived(parquetData(this.doc)!);
  layout = $derived<Layout | undefined>(this.data.layouts.find((l) => l.id === this.current) ?? this.data.layouts[0]);
  boards = $derived((app.libraries.boards ?? []) as readonly Board[]);
  board = $derived(this.boards.find((b) => b.id === this.layout?.boardId));

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

  dispatch(a: Action, key?: string): void {
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
      this.result = await app.live.compute<ParquetResult>(PARQUET_ID, r.spec satisfies ParquetSpec);
    } catch (e) {
      if (!(e instanceof SupersededError)) throw e;
    } finally {
      this.computing = false;
    }
  }

  /**
   * Optimise le départ de la pose affichée dans le worker (tranches, progression, interruptible) ; le meilleur
   * départ est appliqué par une seule action, annulable.
   */
  async optimize(): Promise<void> {
    const l = this.layout;
    const r = toSpec(this.doc, app.libraries);
    if (!l || this.optimizing != null || 'errors' in r) return;
    this.abort = new AbortController();
    this.optimizing = 0;
    try {
      const res = await app.live.optimize<OptimizeResult>(
        PARQUET_ID,
        { spec: r.spec, layoutId: l.id } satisfies OptimizeSpec,
        { signal: this.abort.signal, onProgress: (p) => (this.optimizing = p.percent) },
      );
      if (!res.improved) {
        toast('Le départ actuel est déjà le meilleur trouvé.');
        return;
      }
      this.dispatch({
        type: 'parquet/layout/update',
        layoutId: res.layoutId,
        patch: { offset: res.offset, seed: res.seed },
      });
      toast(`Départ optimisé : ${res.before.boards} → ${res.after.boards} lames.`, {
        action: undoAction(this.store),
        timeout: 8000,
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
    } finally {
      this.optimizing = null;
      this.abort = null;
    }
  }

  stopOptimize(): void {
    this.abort?.abort();
  }

  updateLayout(patch: Partial<Omit<Layout, 'id'>>, key?: string): void {
    if (this.layout) this.dispatch({ type: 'parquet/layout/update', layoutId: this.layout.id, patch }, key);
  }

  /** Changer de lame remet les règles et le mode de pose de son type (docs/parquet/SPEC.md §2). */
  chooseBoard(id: string): void {
    const b = this.boards.find((x) => x.id === id);
    if (!b) return;
    this.updateLayout({ boardId: id, rules: { ...RULES_BY_KIND[b.kind] }, method: METHOD_BY_KIND[b.kind] });
  }

  updateAccessories(patch: Partial<Accessories>, key?: string): void {
    this.dispatch({ type: 'parquet/accessories', patch }, key);
  }

  resetRules(): void {
    if (this.board) this.updateLayout({ rules: { ...RULES_BY_KIND[this.board.kind] } });
  }

  toggleRoom(roomId: string, on: boolean): void {
    const rooms = this.layout?.rooms ?? [];
    this.updateLayout({ rooms: on ? [...rooms, roomId] : rooms.filter((r) => r !== roomId) });
  }

  /**
   * Nouvelle pose : la première couvre la première pièce ; les suivantes partent sans pièce (à cocher) et
   * reprennent la lame et les règles de la pose affichée.
   */
  addLayout(): void {
    const id = crypto.randomUUID();
    const layouts = this.data.layouts;
    const names = layouts.map((l) => l.name);
    let n = layouts.length + 1;
    while (names.includes(`Pose ${n}`)) n++;
    const room = this.doc.plan.rooms[0];
    const from = this.layout;
    const layout = from
      ? createLayout(id, [], {
          name: `Pose ${n}`,
          boardId: from.boardId,
          method: from.method,
          rules: { ...from.rules },
        })
      : createLayout(id, room ? [room.id] : []);
    this.dispatch({ type: 'parquet/layout/add', layout });
    this.current = id;
  }

  removeLayout(): void {
    if (!this.layout) return;
    this.dispatch({ type: 'parquet/layout/remove', layoutId: this.layout.id });
    this.current = null;
  }

  /** Accepter un seuil proposé : il passe dans les seuils posés de la pose. */
  addBreak(s: Segment): void {
    if (this.layout) this.updateLayout({ breaks: [...this.layout.breaks, s] });
  }

  removeBreak(i: number): void {
    if (this.layout) this.updateLayout({ breaks: this.layout.breaks.filter((_, k) => k !== i) });
  }

  /** Séparer la pose en deux le long d'une ligne ; la nouvelle pose devient la pose affichée. */
  split(line: Segment): void {
    if (!this.layout) return;
    const newId = crypto.randomUUID();
    this.dispatch({ type: 'parquet/layout/split', layoutId: this.layout.id, line, newId });
    this.current = newId;
  }
}
