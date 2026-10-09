/**
 * État de l'éditeur de surface : projet (store + historique), surface et sélection courantes, résultat du
 * calcul (worker), optimisation. Toutes les modifications passent par des actions du store.
 */
import type { OptimizerGoal, ProjectResult, ProjectSpec, SurfaceBuild } from '../../core';
import { createReservation, createBand } from '../../state/factories';
import type { Id, Project } from '../../../../state/model';
import type { Band, Opening, ReservationType, Surface, SurfaceRef } from '../../state/model';
import { reservationOffset } from '../../state/surfaces';
import { wallHeightCuts } from '../../state/poses';
import { toProjectSpec } from '../../state/selectors';
import { createProjectStore, type ProjectStore } from '../../../../state/store';
import { carrelage } from '../state.svelte';
import type { Action, PosePatch } from '../../state/actions';
import { carrelageView, type CarrelageProject } from '../../state/data';
import { reduceProject, type ProjectAction } from '../../../../state/project';
import { createSaver, type Saver } from '../../../../storage/autosave';
import { app } from '../../../../ui/lib/app.svelte';
import { toast } from '../../../../ui/lib/toasts.svelte';
import { undoAction } from '../../../../ui/lib/undoToast';

export type Tab = 'tile' | 'pattern' | 'bands' | 'openings' | 'finish';

export interface Selection {
  /** Bande sélectionnée (indice). */
  band: number;
  opening: number;
  piece: number;
}

export interface ColorClip {
  tileId: Id;
  mix: Band['mix'];
  colorB: string;
  groutColor: string;
}

export class EditorState {
  /** Projet entier : plan commun, zones, poses et données de tous les modules, historique unique. */
  doc = $state.raw<Project>(null as never);
  /** Vue carrelage du projet, lue par l'éditeur. */
  project = $state.raw<CarrelageProject>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  /** Pose affichée (une surface par pose). */
  surfaceId = $state<Id>('');
  sel = $state<Selection>({ band: 0, opening: -1, piece: -1 });
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
  bandIndex = $derived(Math.min(Math.max(0, this.sel.band), this.surface.bands.length - 1));
  band = $derived<Band>(this.surface.bands[this.bandIndex]!);
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
    this.sel = { band: this.sel.band, opening: -1, piece: -1, ...s };
  }

  setSurface(id: Id): void {
    if (id === this.surfaceId) return;
    this.surfaceId = id;
    this.sel = { band: 0, opening: -1, piece: -1 };
    history.replaceState(null, '', `#/p/${this.project.id}/m/carrelage/s/${id}`);
  }

  /* ---------- pose ---------- */

  updateSurface(patch: PosePatch, key?: string): void {
    this.dispatch({ type: 'carrelage/pose/update', poseId: this.surface.id, patch }, key);
  }

  /**
   * Hauteur carrelée d'un mur de la pose (ligne haute de sa zone ; par défaut le premier) ; null : jusqu'au
   * plafond. Chaque mur d'une pose sur plusieurs murs a la sienne.
   */
  setWallHeight(height: number | null, wall: SurfaceRef = this.surface.ref): void {
    const z = this.project.zones.find(
      (x) => x.pose === this.surface.id && x.surface.room === wall.room && x.surface.wall === wall.wall,
    );
    if (!z || z.surface.wall == null) return;
    this.dispatch({ type: 'zone/update', zoneId: z.id, cuts: wallHeightCuts(this.project.plan, z.surface, height) });
  }

  /* ---------- bandes ---------- */

  updateBand(patch: Partial<Omit<Band, 'id'>>, key?: string, index = this.bandIndex): void {
    const z = this.surface.bands[index];
    if (z) this.dispatch({ type: 'carrelage/band/update', poseId: this.surface.id, bandId: z.id, patch }, key);
  }

  addBand(): void {
    const z = this.band,
      hasRest = this.surface.bands.some((q) => q.unit === 'rest');
    const nz = createBand(z.tileId, {
      tileUpright: z.tileUpright,
      colorB: z.colorB,
      groutColor: z.groutColor,
      mix: z.mix,
      pattern: 'grid',
      unit: hasRest ? 'rows' : 'rest',
      size: 3,
    });
    this.dispatch({ type: 'carrelage/band/add', poseId: this.surface.id, band: nz, index: this.bandIndex + 1 });
    this.select({ band: this.bandIndex + 1 });
  }

  removeBand(): void {
    if (this.surface.bands.length < 2) return;
    this.dispatch({ type: 'carrelage/band/remove', poseId: this.surface.id, bandId: this.band.id });
    this.select({ band: Math.max(0, this.bandIndex - 1) });
    toast('Bande supprimée.', { action: undoAction(this.store) });
  }

  moveBand(from: number, to: number): void {
    const z = this.surface.bands[from];
    if (!z) return;
    this.dispatch({ type: 'carrelage/band/move', poseId: this.surface.id, bandId: z.id, to });
    if (this.bandIndex === from) this.select({ band: to });
  }

  /** Modèle legacy : 3 rangées décalées, bâtons rompus au centre, 3 rangées décalées. */
  applyFriezeTemplate(): void {
    const z = this.band;
    const base = { tileUpright: z.tileUpright, colorB: z.colorB, groutColor: z.groutColor, mix: z.mix };
    const zones = [
      createBand(z.tileId, { ...base, unit: 'rows', size: 3, pattern: 'half' }),
      createBand(z.tileId, { ...base, unit: 'rest', pattern: 'herring' }),
      createBand(z.tileId, { ...base, unit: 'rows', size: 3, pattern: 'half' }),
    ];
    this.dispatch({ type: 'carrelage/band/replaceAll', poseId: this.surface.id, bands: zones, split: 'h' });
    this.select({ band: 1 });
  }

  copyColors(): void {
    const z = this.band;
    this.colorClip = { tileId: z.tileId, mix: z.mix, colorB: z.colorB, groutColor: z.groutColor };
    toast('Carreau et couleurs copiés.');
  }

  pasteColors(): void {
    if (this.colorClip) this.updateBand({ ...this.colorClip });
  }

  applyColorsToAllBands(): void {
    const z = this.band;
    const patch = {
      tileId: z.tileId,
      tileUpright: z.tileUpright,
      mix: z.mix,
      colorB: z.colorB,
      groutColor: z.groutColor,
    };
    this.dispatch({
      type: 'batch',
      actions: this.surface.bands.map((q) => ({
        type: 'carrelage/band/update' as const,
        poseId: this.surface.id,
        bandId: q.id,
        patch,
      })),
    });
  }

  /* ---------- ouvertures ---------- */

  /** Réservation propre au carrelage (prise, trappe, baignoire, autre), centrée sur la surface. */
  addOpening(type: ReservationType): void {
    const s = this.surface,
      d = createReservation(type, s.ref);
    const width = Math.min(d.width, s.width * 0.8),
      height = Math.min(d.height, s.height * 0.9);
    const sill =
      s.kind === 'floor'
        ? Math.round((s.height - height) / 2)
        : Math.round(Math.max(0, Math.min(d.sill, s.height - height)));
    // position rangée dans le repère de la surface du plan (mur, ou boîte de la pièce)
    const [dx, dy] = reservationOffset(this.project.plan, s);
    const r = { ...d, width, height, sill: sill + dy, x: Math.round((s.width - width) / 2) + dx };
    this.dispatch({ type: 'carrelage/reservation/add', poseId: s.id, reservation: r });
    this.select({ opening: s.openings.length });
  }

  /**
   * Porte ou fenêtre du plan : seules ses finitions changent (profilé, tableaux), ses cotes viennent du plan.
   * Réservation : tout change sauf le type.
   */
  updateOpening(patch: Partial<Omit<Opening, 'id'>>, key?: string, index = this.sel.opening): void {
    const o = this.surface.openings[index];
    if (!o) return;
    const poseId = this.surface.id;
    if (o.source === 'plan') {
      const { covered, revealDepth, reveals } = patch;
      const finish = Object.fromEntries(
        Object.entries({ covered, revealDepth, reveals }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(finish).length)
        this.dispatch({ type: 'carrelage/opening/finish', poseId, openingId: o.id, patch: finish }, key);
      return;
    }
    const { type: _, ...rest } = patch;
    const [dx, dy] = reservationOffset(this.project.plan, this.surface);
    if (rest.x != null) rest.x += dx;
    if (rest.sill != null) rest.sill += dy;
    this.dispatch({ type: 'carrelage/reservation/update', poseId, reservationId: o.id, patch: rest }, key);
  }

  /** Retire une réservation (les portes et fenêtres se retirent dans le plan). */
  removeOpening(): void {
    const o = this.surface.openings[this.sel.opening];
    if (!o || o.source === 'plan') return;
    this.dispatch({ type: 'carrelage/reservation/remove', poseId: this.surface.id, reservationId: o.id });
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
        const z = s.bands[r.zone];
        return z
          ? [
              {
                type: 'carrelage/band/update' as const,
                poseId: s.id,
                bandId: z.id,
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
