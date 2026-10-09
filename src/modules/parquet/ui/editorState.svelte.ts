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
import { coverageText } from '../../../ui/lib/coverageMessages';
import type { Action } from '../state/actions';
import { PARQUET_ID, type Layout, type ParquetPose } from '../state/model';
import { toSpec } from '../state/module';
import {
  addPoseAction,
  layoutsOf,
  newPoseSettings,
  parquetData,
  splitPoseAction,
  toggleRoomAction,
} from '../state/poses';

const newId = () => crypto.randomUUID();

/** Réglages seuls d'une pose vue par l'éditeur. */
const settingsOf = ({ id: _, name: _n, rooms: _r, zones: _z, ...s }: Layout): ParquetPose => s;

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
  /** Poses de parquet du projet (réglages, nom, pièces). */
  layouts = $derived(layoutsOf(this.doc));
  layout = $derived<Layout | undefined>(this.layouts.find((l) => l.id === this.current) ?? this.layouts[0]);
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
        type: 'parquet/pose/update',
        poseId: res.layoutId,
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

  updateLayout(patch: Partial<ParquetPose>, key?: string): void {
    if (this.layout) this.dispatch({ type: 'parquet/pose/update', poseId: this.layout.id, patch }, key);
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

  /** Cocher ou décocher une pièce de la pose affichée ; refus expliqué (sol déjà couvert, pièce non reliée). */
  toggleRoom(roomId: string, on: boolean): void {
    if (!this.layout) return;
    const r = toggleRoomAction(this.doc, this.layout.id, roomId, on, newId);
    if ('error' in r) toast(coverageText(r.error), { tone: 'error' });
    else this.dispatch(r.action);
  }

  /** Nouvelle pose sur une pièce (la première sans revêtement au sol), aux réglages de la pose affichée. */
  addLayout(): void {
    const floors = this.doc.zones.filter((z) => z.surface.wall == null);
    const room = this.doc.plan.rooms.find((r) => !floors.some((z) => z.surface.room === r.id));
    if (!room) {
      toast('Tous les sols ont déjà un revêtement. Décochez une pièce d’une pose ou séparez une pose.', {
        tone: 'error',
      });
      return;
    }
    const settings = newPoseSettings(this.data, this.boards, this.layout?.id);
    const a = addPoseAction(this.doc, room.id, settings, newId);
    this.dispatch(a);
    this.current = a.pose.id;
  }

  removeLayout(): void {
    if (!this.layout) return;
    this.dispatch({ type: 'pose/remove', poseId: this.layout.id });
    this.current = null;
    toast('Pose supprimée.', { action: undoAction(this.store) });
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
    const l = this.layout;
    if (!l) return;
    const r = splitPoseAction(this.doc, l.id, line, settingsOf(l), newId);
    // tout ou rien : la nouvelle pose doit exister après l'action (pièces reliées, zones non vides)
    if (!r || !reduceProject(this.doc, r.action).poses.some((p) => p.id === r.poseId)) {
      toast('Cette ligne ne sépare pas la pose en deux parties posables.', { tone: 'error' });
      return;
    }
    this.dispatch(r.action);
    this.current = r.poseId;
  }
}
