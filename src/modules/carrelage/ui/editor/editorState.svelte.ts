/**
 * État de l'éditeur de surface : projet (store + historique), surface et sélection courantes, résultat du
 * calcul (worker), optimisation. Toutes les modifications passent par des actions du store.
 */
import type { OptimizerGoal, ProjectResult, ProjectSpec, SurfaceBuild } from '../../core';
import type { Action } from '../../state/actions';
import { createCorner, createOpening, createZone, newId } from '../../state/factories';
import type { Corner, Id, Opening, OpeningType, Project, Surface, Zone } from '../../../../state/model';
import { toProjectSpec } from '../../state/selectors';
import { createProjectStore, type ProjectStore } from '../../../../state/store';
import { applyRoom, type RoomUpdate } from '../../state/templates';
import { carrelage } from '../state.svelte';
import { reduce } from '../../state/actions';
import { createSaver, type Saver } from '../../../../storage/autosave';
import { app } from '../../../../ui/lib/app.svelte';
import { toast } from '../../../../ui/lib/toasts.svelte';

export type Tab = 'tile' | 'pattern' | 'zones' | 'openings' | 'finish';

export interface Selection {
  zone: number;
  opening: number;
  corner: number;
  piece: number;
}

export interface ColorClip {
  tileId: Id;
  mix: Zone['mix'];
  colorB: string;
  groutColor: string;
}

export class EditorState {
  project = $state.raw<Project>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  surfaceId = $state<Id>('');
  sel = $state<Selection>({ zone: 0, opening: -1, corner: -1, piece: -1 });
  tab = $state<Tab>('tile');
  mode = $state<'plan' | 'render' | '3d'>('plan');
  /** Vue 3D : surface seule ou toute la pièce (legacy « Surface / Pièce »). */
  scope3d = $state<'surface' | 'room'>('surface');
  result = $state.raw<ProjectResult | null>(null);
  spec = $state.raw<ProjectSpec | null>(null);
  guides = $state.raw<{ zone: number; x: number | null; y: number | null } | null>(null);
  optimizing = $state<{ zone: number; percent: number } | null>(null);
  colorClip = $state.raw<ColorClip | null>(null);

  readonly store: ProjectStore<Project, Action>;
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

  constructor(p: Project, surfaceId: Id | null) {
    this.saver = createSaver(
      (q) => app.saveProject(q),
      300,
      () => toast('Enregistrement impossible : stockage plein ou indisponible.', { tone: 'error' }),
    );
    this.store = createProjectStore(p, reduce, { onChange: (q) => this.saver.schedule(q) });
    this.store.subscribe((s) => {
      this.project = s.project;
      this.canUndo = s.canUndo;
      this.canRedo = s.canRedo;
    });
    this.surfaceId = p.surfaces.some((s) => s.id === surfaceId) ? surfaceId! : p.surfaces[0]!.id;
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

  dispatch(a: Action, key?: string): void {
    this.store.dispatch(a, key);
  }

  /* ---------- sélection ---------- */

  select(s: Partial<Selection>): void {
    this.sel = { zone: this.sel.zone, opening: -1, corner: -1, piece: -1, ...s };
  }

  setSurface(id: Id): void {
    if (id === this.surfaceId) return;
    this.surfaceId = id;
    this.sel = { zone: 0, opening: -1, corner: -1, piece: -1 };
    history.replaceState(null, '', `#/p/${this.project.id}/m/carrelage/s/${id}`);
  }

  /* ---------- surface ---------- */

  updateSurface(patch: Partial<Omit<Surface, 'id' | 'zones' | 'openings' | 'corners'>>, key?: string): void {
    this.dispatch({ type: 'surface/update', surfaceId: this.surface.id, patch }, key);
  }

  addSurface(): void {
    const copy = structuredClone(this.surface);
    const s: Surface = {
      ...copy,
      id: newId(),
      name: 'Surface ' + (this.project.surfaces.length + 1),
      zones: copy.zones.map((z) => ({ ...z, id: newId() })),
      openings: copy.openings.map((o) => ({ ...o, id: newId() })),
      corners: copy.corners.map((c) => ({ ...c, id: newId() })),
    };
    if (s.plinth)
      s.plinth = {
        ...s.plinth,
        zoneId: s.zones[copy.zones.findIndex((z) => z.id === copy.plinth!.zoneId)]?.id ?? s.zones[0]!.id,
      };
    this.dispatch({ type: 'surface/add', surface: s });
    this.setSurface(s.id);
  }

  removeSurface(): void {
    if (this.project.surfaces.length < 2) return;
    const i = this.surfaceIndex,
      name = this.surface.name;
    this.dispatch({ type: 'surface/remove', surfaceId: this.surface.id });
    this.setSurface(this.project.surfaces[Math.max(0, i - 1)]!.id);
    toast(`Surface « ${name} » supprimée.`, { action: { label: 'Annuler', run: () => this.store.undo() } });
  }

  applyRoom(i: RoomUpdate): void {
    this.dispatch({ type: 'project/replace', project: applyRoom(this.project, this.surface, i) });
  }

  /* ---------- zones ---------- */

  updateZone(patch: Partial<Omit<Zone, 'id'>>, key?: string, index = this.zoneIndex): void {
    const z = this.surface.zones[index];
    if (z) this.dispatch({ type: 'zone/update', surfaceId: this.surface.id, zoneId: z.id, patch }, key);
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
    this.dispatch({ type: 'zone/add', surfaceId: this.surface.id, zone: nz, index: this.zoneIndex + 1 });
    this.select({ zone: this.zoneIndex + 1 });
  }

  removeZone(): void {
    if (this.surface.zones.length < 2) return;
    this.dispatch({ type: 'zone/remove', surfaceId: this.surface.id, zoneId: this.zone.id });
    this.select({ zone: Math.max(0, this.zoneIndex - 1) });
    toast('Zone supprimée.', { action: { label: 'Annuler', run: () => this.store.undo() } });
  }

  moveZone(from: number, to: number): void {
    const z = this.surface.zones[from];
    if (!z) return;
    this.dispatch({ type: 'zone/move', surfaceId: this.surface.id, zoneId: z.id, to });
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
    this.dispatch({ type: 'zone/replaceAll', surfaceId: this.surface.id, zones, split: 'h' });
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
        type: 'zone/update' as const,
        surfaceId: this.surface.id,
        zoneId: q.id,
        patch,
      })),
    });
  }

  /* ---------- ouvertures ---------- */

  addOpening(type: OpeningType): void {
    const s = this.surface,
      d = createOpening(type);
    const width = Math.min(d.width, s.width * 0.8),
      height = Math.min(d.height, s.height * 0.9);
    const sill =
      s.kind === 'floor'
        ? Math.round((s.height - height) / 2)
        : Math.round(Math.max(0, Math.min(d.sill, s.height - height)));
    const o: Opening = { ...d, width, height, sill, x: Math.round((s.width - width) / 2) };
    this.dispatch({ type: 'opening/add', surfaceId: s.id, opening: o });
    this.select({ opening: s.openings.length });
  }

  updateOpening(patch: Partial<Omit<Opening, 'id'>>, key?: string, index = this.sel.opening): void {
    const o = this.surface.openings[index];
    if (o) this.dispatch({ type: 'opening/update', surfaceId: this.surface.id, openingId: o.id, patch }, key);
  }

  removeOpening(): void {
    const o = this.surface.openings[this.sel.opening];
    if (!o) return;
    this.dispatch({ type: 'opening/remove', surfaceId: this.surface.id, openingId: o.id });
    this.select({ opening: -1 });
    toast('Ouverture supprimée.', { action: { label: 'Annuler', run: () => this.store.undo() } });
  }

  /* ---------- angles ---------- */

  addCorner(): void {
    const s = this.surface;
    const xs = s.corners.map((c) => c.x).sort((a, b) => a - b);
    const bs = [0, ...xs, s.width];
    let gi = 0;
    for (let i = 0; i < bs.length - 1; i++) if (bs[i + 1]! - bs[i]! > bs[gi + 1]! - bs[gi]!) gi = i;
    const c: Corner = createCorner({ x: Math.round((bs[gi]! + bs[gi + 1]!) / 2) });
    this.dispatch({ type: 'corner/add', surfaceId: s.id, corner: c });
    this.select({ corner: s.corners.length });
  }

  updateCorner(patch: Partial<Omit<Corner, 'id'>>, key?: string, index = this.sel.corner): void {
    const c = this.surface.corners[index];
    if (c) this.dispatch({ type: 'corner/update', surfaceId: this.surface.id, cornerId: c.id, patch }, key);
  }

  removeCorner(): void {
    const c = this.surface.corners[this.sel.corner];
    if (!c) return;
    this.dispatch({ type: 'corner/remove', surfaceId: this.surface.id, cornerId: c.id });
    this.select({ corner: -1 });
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
                type: 'zone/update' as const,
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
        { action: actions.length ? { label: 'Annuler', run: () => this.store.undo() } : undefined, timeout: 8000 },
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
