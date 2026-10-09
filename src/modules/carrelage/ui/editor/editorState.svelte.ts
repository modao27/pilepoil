/**
 * État de l'éditeur de surface : projet (store + historique), surface et sélection courantes, résultat du
 * calcul (worker), optimisation. Toutes les modifications passent par des actions du store.
 */
import type { OptimizerGoal, ProjectResult, ProjectSpec, SurfaceBuild } from '../../core';
import { createReservation, createZone } from '../../state/factories';
import type { Id, Project } from '../../../../state/model';
import type { Opening, ReservationType, Surface, Zone } from '../../state/model';
import { toProjectSpec } from '../../state/selectors';
import { createProjectStore, type ProjectStore } from '../../../../state/store';
import { carrelage } from '../state.svelte';
import type { Action, SurfacePatch } from '../../state/actions';
import { carrelageView, type CarrelageProject } from '../../state/data';
import { reduceProject, type ProjectAction } from '../../../../state/project';
import { createSaver, type Saver } from '../../../../storage/autosave';
import { app } from '../../../../ui/lib/app.svelte';
import { toast } from '../../../../ui/lib/toasts.svelte';
import { undoAction } from '../../../../ui/lib/undoToast';

export type Tab = 'tile' | 'pattern' | 'zones' | 'openings' | 'finish';

export interface Selection {
  zone: number;
  opening: number;
  piece: number;
}

export interface ColorClip {
  tileId: Id;
  mix: Zone['mix'];
  colorB: string;
  groutColor: string;
}

export class EditorState {
  /** Projet entier (v2) : plan commun et données de tous les modules, historique unique. */
  doc = $state.raw<Project>(null as never);
  /** Vue carrelage du projet, lue par l'éditeur. */
  project = $state.raw<CarrelageProject>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  surfaceId = $state<Id>('');
  sel = $state<Selection>({ zone: 0, opening: -1, piece: -1 });
  tab = $state<Tab>('tile');
  mode = $state<'plan' | 'render' | '3d'>('plan');
  /** Vue 3D : surface seule ou toute la pièce du plan. */
  scope3d = $state<'surface' | 'room'>('surface');
  result = $state.raw<ProjectResult | null>(null);
  spec = $state.raw<ProjectSpec | null>(null);
  guides = $state.raw<{ zone: number; x: number | null; y: number | null } | null>(null);
  optimizing = $state<{ zone: number; percent: number } | null>(null);
  colorClip = $state.raw<ColorClip | null>(null);

  readonly store: ProjectStore<Project, ProjectAction>;
  private saver: Saver<Project>;
  private abort: AbortController | null = null;

  surfaceIndex = $derived(
    Math.max(
      0,
      this.project.surfaces.findIndex((s) => s.id === this.surfaceId),
    ),
  );
  surface = $derived<Surface>(this.project.surfaces[this.surfaceIndex]!);
  zoneIndex = $derived(Math.min(Math.max(0, this.sel.zone), this.surface.zones.length - 1));
  zone = $derived<Zone>(this.surface.zones[this.zoneIndex]!);
  surfaceResult = $derived(this.result?.surfaces[this.surfaceIndex] ?? null);
  build = $derived<SurfaceBuild | null>(this.surfaceResult?.ok ? this.surfaceResult.value : null);
  /** Indice de la première pièce de la surface dans le plan de découpe du projet. */
  offset = $derived(
    this.result
      ? this.result.surfaces.slice(0, this.surfaceIndex).reduce((t, s) => t + (s.ok ? s.value.pieces.length : 0), 0)
      : 0,
  );

  /** `p` doit avoir le carrelage activé (EditorScreen le vérifie). */
  constructor(p: Project, surfaceId: Id | null) {
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
      this.project = carrelageView(s.project)!;
      this.canUndo = s.canUndo;
      this.canRedo = s.canRedo;
    });
    const v = this.project;
    this.surfaceId = v.surfaces.some((s) => s.id === surfaceId) ? surfaceId! : v.surfaces[0]!.id;
  }

  /** Calcule le projet (dernière demande seulement) ; appelé à chaque changement du projet ou de la bibliothèque. */
  async recompute(): Promise<void> {
    const { spec } = toProjectSpec(this.project, carrelage.tiles);
    const r = await carrelage.computeLive(spec);
    if (r) {
      this.result = r;
      this.spec = spec;
    }
  }

  flush(): Promise<void> {
    return this.saver.flush();
  }

  dispatch(a: ProjectAction | Action, key?: string): void {
    this.store.dispatch(a, key);
  }

  /* ---------- sélection ---------- */

  select(s: Partial<Selection>): void {
    this.sel = { zone: this.sel.zone, opening: -1, piece: -1, ...s };
  }

  setSurface(id: Id): void {
    if (id === this.surfaceId) return;
    this.surfaceId = id;
    this.sel = { zone: 0, opening: -1, piece: -1 };
    history.replaceState(null, '', `#/p/${this.project.id}/m/carrelage/s/${id}`);
  }

  /* ---------- surface ---------- */

  updateSurface(patch: SurfacePatch, key?: string): void {
    this.dispatch({ type: 'carrelage/surface/update', surfaceId: this.surface.id, patch }, key);
  }

  /* ---------- zones ---------- */

  updateZone(patch: Partial<Omit<Zone, 'id'>>, key?: string, index = this.zoneIndex): void {
    const z = this.surface.zones[index];
    if (z) this.dispatch({ type: 'carrelage/zone/update', surfaceId: this.surface.id, zoneId: z.id, patch }, key);
  }

  addZone(): void {
    const z = this.zone,
      hasRest = this.surface.zones.some((q) => q.unit === 'rest');
    const nz = createZone(z.tileId, {
      tileUpright: z.tileUpright,
      colorB: z.colorB,
      groutColor: z.groutColor,
      mix: z.mix,
      pattern: 'grid',
      unit: hasRest ? 'rows' : 'rest',
      size: 3,
    });
    this.dispatch({ type: 'carrelage/zone/add', surfaceId: this.surface.id, zone: nz, index: this.zoneIndex + 1 });
    this.select({ zone: this.zoneIndex + 1 });
  }

  removeZone(): void {
    if (this.surface.zones.length < 2) return;
    this.dispatch({ type: 'carrelage/zone/remove', surfaceId: this.surface.id, zoneId: this.zone.id });
    this.select({ zone: Math.max(0, this.zoneIndex - 1) });
    toast('Zone supprimée.', { action: undoAction(this.store) });
  }

  moveZone(from: number, to: number): void {
    const z = this.surface.zones[from];
    if (!z) return;
    this.dispatch({ type: 'carrelage/zone/move', surfaceId: this.surface.id, zoneId: z.id, to });
    if (this.zoneIndex === from) this.select({ zone: to });
  }

  /** Modèle legacy : 3 rangées décalées, bâtons rompus au centre, 3 rangées décalées. */
  applyFriezeTemplate(): void {
    const z = this.zone;
    const base = { tileUpright: z.tileUpright, colorB: z.colorB, groutColor: z.groutColor, mix: z.mix };
    const zones = [
      createZone(z.tileId, { ...base, unit: 'rows', size: 3, pattern: 'half' }),
      createZone(z.tileId, { ...base, unit: 'rest', pattern: 'herring' }),
      createZone(z.tileId, { ...base, unit: 'rows', size: 3, pattern: 'half' }),
    ];
    this.dispatch({ type: 'carrelage/zone/replaceAll', surfaceId: this.surface.id, zones, split: 'h' });
    this.select({ zone: 1 });
  }

  copyColors(): void {
    const z = this.zone;
    this.colorClip = { tileId: z.tileId, mix: z.mix, colorB: z.colorB, groutColor: z.groutColor };
    toast('Carreau et couleurs copiés.');
  }

  pasteColors(): void {
    if (this.colorClip) this.updateZone({ ...this.colorClip });
  }

  applyColorsToAllZones(): void {
    const z = this.zone;
    const patch = {
      tileId: z.tileId,
      tileUpright: z.tileUpright,
      mix: z.mix,
      colorB: z.colorB,
      groutColor: z.groutColor,
    };
    this.dispatch({
      type: 'batch',
      actions: this.surface.zones.map((q) => ({
        type: 'carrelage/zone/update' as const,
        surfaceId: this.surface.id,
        zoneId: q.id,
        patch,
      })),
    });
  }

  /* ---------- ouvertures ---------- */

  /** Réservation propre au carrelage (prise, trappe, baignoire, autre), centrée sur la surface. */
  addOpening(type: ReservationType): void {
    const s = this.surface,
      d = createReservation(type);
    const width = Math.min(d.width, s.width * 0.8),
      height = Math.min(d.height, s.height * 0.9);
    const sill =
      s.kind === 'floor'
        ? Math.round((s.height - height) / 2)
        : Math.round(Math.max(0, Math.min(d.sill, s.height - height)));
    const r = { ...d, width, height, sill, x: Math.round((s.width - width) / 2) };
    this.dispatch({ type: 'carrelage/reservation/add', surfaceId: s.id, reservation: r });
    this.select({ opening: s.openings.length });
  }

  /**
   * Porte ou fenêtre du plan : seules ses finitions changent (profilé, tableaux), ses cotes viennent du plan.
   * Réservation : tout change sauf le type.
   */
  updateOpening(patch: Partial<Omit<Opening, 'id'>>, key?: string, index = this.sel.opening): void {
    const o = this.surface.openings[index];
    if (!o) return;
    const surfaceId = this.surface.id;
    if (o.source === 'plan') {
      const { covered, revealDepth, reveals } = patch;
      const finish = Object.fromEntries(
        Object.entries({ covered, revealDepth, reveals }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(finish).length)
        this.dispatch({ type: 'carrelage/opening/finish', surfaceId, openingId: o.id, patch: finish }, key);
      return;
    }
    const { type: _, ...rest } = patch;
    this.dispatch({ type: 'carrelage/reservation/update', surfaceId, reservationId: o.id, patch: rest }, key);
  }

  /** Retire une réservation (les portes et fenêtres se retirent dans le plan). */
  removeOpening(): void {
    const o = this.surface.openings[this.sel.opening];
    if (!o || o.source === 'plan') return;
    this.dispatch({ type: 'carrelage/reservation/remove', surfaceId: this.surface.id, reservationId: o.id });
    this.select({ opening: -1 });
    toast('Ouverture supprimée.', { action: undoAction(this.store) });
  }

  /* ---------- optimisation ---------- */

  async optimize(zones: number[], goal: OptimizerGoal = this.project.settings.optimizerGoal): Promise<void> {
    if (this.optimizing || !this.spec) return;
    const surf = this.spec.surfaces[this.surfaceIndex];
    if (!surf) return;
    this.abort = new AbortController();
    this.optimizing = { zone: zones[0] ?? 0, percent: 0 };
    try {
      const res = await carrelage.optimize(surf, zones, goal, this.spec.settings, {
        signal: this.abort.signal,
        onProgress: (p) => (this.optimizing = { zone: p.zone, percent: p.percent }),
      });
      const s = this.surface;
      const actions: Action[] = res.zones.flatMap((r) => {
        const z = s.zones[r.zone];
        return z
          ? [
              {
                type: 'carrelage/zone/update' as const,
                surfaceId: s.id,
                zoneId: z.id,
                patch: { offsetX: r.offsetX, offsetY: r.offsetY, start: r.start },
              },
            ]
          : [];
      });
      this.dispatch({ type: 'batch', actions });
      const b = res.before,
        a = res.after;
      toast(
        `Départ optimisé. Carreaux ${b.needed} → ${a.needed}, coupes fines ${b.thin} → ${a.thin}, coupes apparentes ${b.vis} → ${a.vis}.`,
        { action: actions.length ? undoAction(this.store) : undefined, timeout: 8000 },
      );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast('Optimisation impossible.', { tone: 'error' });
      else toast('Optimisation arrêtée, rien n’a changé.');
    } finally {
      this.optimizing = null;
      this.abort = null;
    }
  }

  cancelOptimize(): void {
    this.abort?.abort();
  }
}
