/**
 * État de l'éditeur de plan : projet (store + historique commun à tout le projet), sélection, mode
 * (sélection, dessin libre, liaison de deux portes). Toutes les modifications passent par des actions.
 */
import type { Point, Polygon } from '../../core/geometry/types';
import { lRoom, rectRoom, roomFromOutline, uRoom } from '../../core/plan/factories';
import { deriveSite } from '../../core/plan/derive';
import {
  DEFAULT_PARTITION_THICKNESS,
  MIN_PARTITION_LENGTH,
  type WorksAction,
  type WorksIssue,
} from '../../core/plan/works';
import type { PlanAction } from '../../core/plan/reduce';
import { doorBetween, facingWalls, placeAgainst, type FacingWalls } from '../../core/plan/neighbors';
import { signedArea } from '../../core/geometry/polygon';
import { EQUIPMENT } from '../../core/plan/equipment';
import { clockwise, placeNewRoom } from '../../core/plan/snap';
import type {
  Demolition,
  Id,
  Obstacle,
  Partition,
  PartitionOpening,
  Plan,
  PlanRoom,
  WallOpening,
} from '../../core/plan/types';
import { alignForPassage, validatePlan, validateRoom, type PlanError } from '../../core/plan/validate';
import { DEFAULT_WALL_THICKNESS, wallIndex, wallLength, wallSegment } from '../../core/plan/walls';
import type { Project } from '../../state/model';
import { reduceProject, type ProjectAction } from '../../state/project';
import { lostByPose, type PoseLoss } from '../../core/coverage';
import { createProjectStore, type ProjectStore } from '../../state/store';
import { createSaver, type Saver } from '../../storage/autosave';
import { app } from '../lib/app.svelte';
import { toast } from '../lib/toasts.svelte';
import { undoAction } from '../lib/undoToast';
import { moduleById } from '../../modules/registry';
import { posesInRoom } from '../../core/coverage';

const newId = (): Id => crypto.randomUUID();

export type PlanSelection =
  | { kind: 'room'; room: Id }
  | { kind: 'wall'; room: Id; wall: Id }
  | { kind: 'point'; room: Id; index: number }
  | { kind: 'opening'; room: Id; opening: Id }
  | { kind: 'obstacle'; room: Id; obstacle: Id }
  | { kind: 'passage'; passage: Id }
  | { kind: 'partition'; partition: Id }
  | { kind: 'demolition'; demolition: Id }
  | null;

export type Shape =
  | { kind: 'rect'; length: number; width: number }
  | { kind: 'l'; length: number; width: number; cutLength: number; cutWidth: number }
  | { kind: 'u'; length: number; width: number; arm: number; depth: number }
  /** Relevé mur après mur : contour déjà calculé (`core/plan/survey`). */
  | { kind: 'survey'; outline: Polygon };

/** Contour en sens horaire, coin haut gauche du rectangle englobant en (0, 0). */
const normalizeOutline = (outline: Polygon): Polygon => {
  const x0 = Math.min(...outline.map((p) => p[0])),
    y0 = Math.min(...outline.map((p) => p[1]));
  return clockwise(outline.map(([x, y]): Point => [x - x0, y - y0]));
};

export type OpeningKind = WallOpening['kind'];

/** Dimensions par défaut d'une ouverture, mm. */
export const OPENING_SIZES: Record<OpeningKind, Pick<WallOpening, 'width' | 'height' | 'sill'>> = {
  door: { width: 830, height: 2040, sill: 0 },
  'french-window': { width: 1200, height: 2150, sill: 0 },
  window: { width: 1000, height: 1150, sill: 950 },
};

export class PlanEditorState {
  doc = $state.raw<Project>(null as never);
  canUndo = $state(false);
  canRedo = $state(false);
  sel = $state.raw<PlanSelection>(null);
  mode = $state<'select' | 'draw' | 'link' | 'partition' | 'demolish'>('select');
  /** Calque : l'état existant (relevé) ou les travaux (cloisons, démolitions) sur le plan après travaux. */
  layer = $state<'existing' | 'works'>('existing');
  /** Cloison en cours de tracé : premier point posé, repère du plan. */
  partitionFrom = $state.raw<Point | null>(null);
  /** Action de travaux qui fait perdre des revêtements, en attente de confirmation. */
  pending = $state.raw<{ action: ProjectAction; loss: PoseLoss[] } | null>(null);
  /** Dessin libre en cours : points dans le repère du plan d'ensemble. */
  draft = $state.raw<Point[]>([]);
  /** Première porte d'un passage en cours de liaison. */
  linkFrom = $state.raw<{ room: Id; opening: Id } | null>(null);
  /** Contour dessiné fermé et valide : en attente de son nom. */
  naming = $state(false);
  /** Pièces nées d'une cloison, en attente de leur nom (proposé : « Séjour (2) »). */
  namingNew = $state<{ id: Id; name: string }[] | null>(null);
  /** Pièce à supprimer qui porte des revêtements : en attente de confirmation. */
  removing = $state.raw<{ room: PlanRoom; usage: string[] } | null>(null);
  /** Projet neuf (#/new) : rien n'est enregistré tant qu'il n'a pas de pièce (pas de projet vide). */
  isNew = $state(false);

  readonly store: ProjectStore<Project, ProjectAction>;
  private saver: Saver<Project>;

  /** Plan affiché et édité : l'état existant, ou le plan après travaux (lecture seule) dans le calque travaux. */
  plan = $derived<Plan>(this.layer === 'existing' ? this.doc.site.existing : this.doc.plan);
  errors = $derived<PlanError[]>(validatePlan(this.doc.site.existing));
  /** Problèmes des cloisons et démolitions. */
  issues = $derived<WorksIssue[]>(deriveSite(this.doc.site).issues);
  /** Cloisons basses qui ne traversent pas la pièce : des murets, obstacles dans le sol. */
  lowObstacles = $derived<Id[]>(deriveSite(this.doc.site).lowObstacles);

  constructor(p: Project, o: { isNew?: boolean } = {}) {
    this.isNew = o.isNew ?? false;
    this.saver = createSaver(
      (q) => app.saveProject(q),
      300,
      () => toast('Enregistrement impossible : stockage plein ou indisponible.', { tone: 'error' }),
    );
    this.store = createProjectStore(p, (q: Project, a: ProjectAction) => reduceProject(q, a), {
      onChange: (q) => {
        if (!this.isNew || q.plan.rooms.length) this.saver.schedule(q);
      },
    });
    this.store.subscribe((s) => {
      this.doc = s.project;
      this.canUndo = s.canUndo;
      this.canRedo = s.canRedo;
      // sélection devenue invalide (annulation, suppression)
      if (this.sel && !this.selected()) this.sel = null;
    });
  }

  flush(): Promise<void> {
    return this.saver.flush();
  }

  dispatch(a: PlanAction | ProjectAction, key?: string): void {
    this.store.dispatch(a, key);
  }

  undo(): void {
    this.store.undo();
  }

  redo(): void {
    this.store.redo();
  }

  /* ---------- lecture ---------- */

  room(id: Id | undefined): PlanRoom | undefined {
    return id == null ? undefined : this.plan.rooms.find((r) => r.id === id);
  }

  /** Élément sélectionné, s'il existe encore. */
  selected(): PlanRoom | WallOpening | Obstacle | Plan['passages'][number] | Id | number | undefined {
    const s = this.sel;
    if (!s) return undefined;
    if (s.kind === 'passage') return this.plan.passages.find((p) => p.id === s.passage);
    if (s.kind === 'partition') return this.doc.site.partitions.find((p) => p.id === s.partition)?.id;
    if (s.kind === 'demolition') return this.doc.site.demolitions.find((d) => d.id === s.demolition)?.id;
    const r = this.room(s.room);
    if (!r) return undefined;
    switch (s.kind) {
      case 'room':
        return r;
      case 'wall':
        return r.walls.find((w) => w.id === s.wall)?.id;
      case 'point':
        return s.index < r.outline.length ? s.index : undefined;
      case 'opening':
        return r.openings.find((o) => o.id === s.opening);
      case 'obstacle':
        return r.obstacles.find((o) => o.id === s.obstacle);
    }
  }

  /** Pièce de la sélection courante. */
  selectedRoom = $derived<PlanRoom | undefined>(
    this.sel && this.sel.kind !== 'passage' && this.sel.kind !== 'partition' && this.sel.kind !== 'demolition'
      ? this.room(this.sel.room)
      : undefined,
  );

  select(s: PlanSelection): void {
    this.sel = s;
    if (this.mode === 'link' && s?.kind !== 'opening') this.cancelLink();
  }

  /* ---------- calques et travaux ---------- */

  setLayer(layer: 'existing' | 'works'): void {
    if (layer === this.layer) return;
    this.cancelLink();
    this.cancelDraw();
    this.cancelTool();
    this.layer = layer;
    this.sel = null;
  }

  /** Nom d'une cloison : « Cloison 2 ». */
  partitionName(id: Id): string {
    return 'Cloison ' + (this.doc.site.partitions.findIndex((p) => p.id === id) + 1);
  }

  partition(id: Id): Partition | undefined {
    return this.doc.site.partitions.find((p) => p.id === id);
  }

  demolition(id: Id): Demolition | undefined {
    return this.doc.site.demolitions.find((d) => d.id === id);
  }

  /** Problèmes d'un travail ou d'une de ses ouvertures. */
  issuesOf(...ids: Id[]): WorksIssue[] {
    return this.issues.filter((i) => ids.includes(i.id));
  }

  /**
   * Applique une action de travaux ; si elle fait perdre des revêtements (zones rognées ou orphelines), elle attend
   * la confirmation de l'utilisateur (`pending`). Rien n'est supprimé dans les deux cas : annuler rétablit tout.
   */
  commit(action: ProjectAction, key?: string): boolean {
    const before = this.store.get().project;
    action = this.withTool(action);
    const next = reduceProject(before, action);
    if (next === before) return false;
    const loss = lostByPose(before.plan, next.plan, before.zones, before.poses);
    if (loss.length) {
      this.pending = { action, loss };
      return false;
    }
    this.dispatch(action, key);
    return true;
  }

  /**
   * Tracer la première cloison active le module des cloisons ; passer une cloison en maçonnerie active celui de la
   * maçonnerie (leurs données sont créées hors du réducteur).
   */
  private withTool(action: ProjectAction): ProjectAction {
    const w = action as WorksAction;
    const id =
      w.type === 'plan/partition/add'
        ? w.partition.construction === 'masonry'
          ? 'maconnerie'
          : 'cloisons'
        : w.type === 'plan/partition/update' && w.patch.construction === 'masonry'
          ? 'maconnerie'
          : null;
    const m = id && !Object.hasOwn(this.doc.modules, id) ? moduleById(id) : undefined;
    if (!id || !m) return action;
    const doc = { schemaVersion: m.schemaVersion, data: m.create(this.doc.plan) };
    return { type: 'batch', actions: [{ type: 'project/module/add', id, doc }, action] };
  }

  confirmPending(): void {
    const p = this.pending;
    this.pending = null;
    if (p) this.dispatch(p.action);
  }

  cancelPending(): void {
    this.pending = null;
  }

  /** Cloison : une face sur le trait tracé, épaisseur à droite du sens de tracé, 72 mm. */
  startPartition(): void {
    this.layer = 'works';
    this.mode = 'partition';
    this.partitionFrom = null;
    this.sel = null;
  }

  startDemolish(): void {
    this.layer = 'works';
    this.mode = 'demolish';
    this.partitionFrom = null;
    this.sel = null;
  }

  cancelTool(): void {
    if (this.mode === 'partition' || this.mode === 'demolish') this.mode = 'select';
    this.partitionFrom = null;
  }

  /** Pose un point de la cloison ; le second point la crée (une seule étape d'annulation). */
  partitionPoint(p: Point): void {
    const from = this.partitionFrom;
    if (!from) {
      this.partitionFrom = p;
      return;
    }
    if (Math.hypot(p[0] - from[0], p[1] - from[1]) < MIN_PARTITION_LENGTH) {
      toast('Cloison trop courte : choisissez un point plus loin.', { tone: 'error' });
      return;
    }
    const partition: Partition = {
      id: newId(),
      a: from,
      b: p,
      thickness: DEFAULT_PARTITION_THICKNESS,
      align: 'right',
      openings: [],
    };
    this.partitionFrom = null;
    this.mode = 'select';
    const known = this.doc.plan.rooms.map((r) => r.id);
    const done = this.commit({ type: 'plan/partition/add', partition });
    const fresh = this.doc.plan.rooms.filter((r) => !known.includes(r.id));
    if (done && fresh.length) this.namingNew = fresh.map((r) => ({ id: r.id, name: r.name }));
    // la cloison est choisie même si la confirmation d'une perte de revêtement est en attente
    this.sel = { kind: 'partition', partition: partition.id };
    const issue = this.issuesOf(partition.id).find((i) => i.severity === 'error');
    if (issue) toast(WORKS_TOAST[issue.code] ?? 'Cette cloison est refusée.', { tone: 'error' });
  }

  /** Valide les noms choisis pour les pièces nées d'une cloison. */
  nameNewRooms(): void {
    for (const r of this.namingNew ?? [])
      if (r.name.trim() !== this.doc.plan.rooms.find((x) => x.id === r.id)?.name)
        this.dispatch({ type: 'plan/site/room-name', roomId: r.id, name: r.name });
    this.namingNew = null;
  }

  removePartition(id: Id): void {
    const name = this.partitionName(id);
    this.commit({ type: 'plan/partition/remove', partitionId: id });
    this.sel = null;
    toast(`${name} supprimée.`, { action: undoAction(this.store) });
  }

  updatePartition(id: Id, patch: Partial<Omit<Partition, 'id'>>, key?: string): void {
    this.commit({ type: 'plan/partition/update', partitionId: id, patch }, key);
  }

  addPartitionOpening(id: Id, kind: PartitionOpening['kind']): void {
    const q = this.partition(id);
    if (!q) return;
    const length = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
    const width = Math.min(830, Math.max(100, Math.floor(length - 200)));
    const opening: PartitionOpening = {
      id: newId(),
      kind,
      offset: Math.max(0, Math.round((length - width) / 2 / 10) * 10),
      width,
      height: 2040,
    };
    this.commit({ type: 'plan/partition/opening/add', partitionId: id, opening });
  }

  updatePartitionOpening(id: Id, openingId: Id, patch: Partial<Omit<PartitionOpening, 'id'>>, key?: string): void {
    this.commit({ type: 'plan/partition/opening/update', partitionId: id, openingId, patch }, key);
  }

  removePartitionOpening(id: Id, openingId: Id): void {
    this.commit({ type: 'plan/partition/opening/remove', partitionId: id, openingId });
  }

  /** Démolit tout un mur de l'état existant (les bornes se règlent ensuite) ; refusé sur un mur verrouillé. */
  demolishWall(roomId: Id, wallId: Id): void {
    const room = this.doc.site.existing.rooms.find((r) => r.id === roomId);
    const i = room ? wallIndex(room, wallId) : -1;
    if (!room || i < 0) return;
    const w = room.walls[i]!;
    if (w.locked) {
      const kind = w.locked === 'exterior' ? 'extérieur' : 'porteur';
      toast(
        `Mur ${i + 1} de ${room.name} : mur ${kind}, verrouillé. Déverrouillez-le dans l’état des lieux pour le démolir.`,
        { tone: 'error' },
      );
      return;
    }
    const d: Demolition = { id: newId(), room: roomId, wall: wallId, from: 0, to: Math.round(wallLength(room, i)) };
    this.commit({ type: 'plan/demolition/add', demolition: d });
    const issue = this.issuesOf(d.id).find((x) => x.severity === 'error');
    if (issue) toast(WORKS_TOAST[issue.code] ?? 'Cette démolition est refusée.', { tone: 'error' });
    this.mode = 'select';
    this.sel = { kind: 'demolition', demolition: d.id };
  }

  updateDemolition(id: Id, patch: Partial<Pick<Demolition, 'from' | 'to'>>, key?: string): void {
    this.commit({ type: 'plan/demolition/update', demolitionId: id, patch }, key);
  }

  removeDemolition(id: Id): void {
    this.commit({ type: 'plan/demolition/remove', demolitionId: id });
    this.sel = null;
    toast('Démolition retirée : le mur est rétabli.', { action: undoAction(this.store) });
  }

  /** Verrou d'un mur de l'état existant. */
  lockWall(roomId: Id, wallId: Id, locked: 'exterior' | 'bearing' | null): void {
    this.dispatch({ type: 'plan/wall/update', roomId, wallId, patch: { locked: locked ?? undefined } });
  }

  /** Verrouille comme extérieurs les murs sans pièce en vis-à-vis, en une étape ; renvoie leur nombre. */
  lockExterior(): number {
    const existing = this.doc.site.existing;
    const faced = facingWalls(existing).flatMap((f) => [`${f.a.room}~${f.a.wall}`, `${f.b.room}~${f.b.wall}`]);
    const actions: ProjectAction[] = [];
    for (const r of existing.rooms)
      for (const w of r.walls)
        if (!faced.includes(`${r.id}~${w.id}`) && !w.locked)
          actions.push({ type: 'plan/wall/update', roomId: r.id, wallId: w.id, patch: { locked: 'exterior' } });
    if (!actions.length) {
      toast('Tous les murs sans pièce en face sont déjà verrouillés.');
      return 0;
    }
    this.dispatch({ type: 'batch', actions });
    const n = actions.length;
    toast(
      `${n} mur${n > 1 ? 's' : ''} verrouillé${n > 1 ? 's' : ''} comme extérieur${n > 1 ? 's' : ''}. Vérifiez-les.`,
      {
        action: undoAction(this.store),
      },
    );
    return n;
  }

  /* ---------- pièces ---------- */

  /**
   * Ajoute une pièce : à côté du plan, ou contre le mur `against` d'une pièce (de l'autre côté de sa cloison,
   * alignée sur le début du mur ; à côté du plan si la pièce n'a pas de mur dans ce sens).
   */
  addRoom(shape: Shape, name: string, against?: { room: Id; wall: Id }): void {
    const opts = { name, origin: placeNewRoom(this.plan), thickness: app.wallThickness };
    let room =
      shape.kind === 'rect'
        ? rectRoom(shape.length, shape.width, opts, newId)
        : shape.kind === 'l'
          ? lRoom(shape.length, shape.width, shape.cutLength, shape.cutWidth, opts, newId)
          : shape.kind === 'u'
            ? uRoom(shape.length, shape.width, shape.arm, shape.depth, opts, newId)
            : roomFromOutline(normalizeOutline(shape.outline), opts, newId);
    if (against) {
      const origin = placeAgainst(this.plan, against, room.outline);
      if (origin) room = { ...room, origin };
      else toast('Ce mur est en biais : la pièce est placée à côté du plan.');
    }
    this.dispatch({ type: 'plan/room/add', room });
    this.sel = { kind: 'room', room: room.id };
  }

  /** Murs d'autres pièces en vis-à-vis de la pièce, de l'autre côté d'une cloison. */
  neighbors(roomId: Id): FacingWalls[] {
    return facingWalls(this.plan, roomId);
  }

  /** Un passage relie déjà ces deux murs en vis-à-vis. */
  linked(f: FacingWalls): boolean {
    const wallOf = (d: { room: Id; opening: Id }) => this.room(d.room)?.openings.find((o) => o.id === d.opening)?.wall;
    const on = (d: { room: Id; opening: Id }, w: { room: Id; wall: Id }) => d.room === w.room && wallOf(d) === w.wall;
    return this.plan.passages.some((p) => (on(p.a, f.a) && on(p.b, f.b)) || (on(p.a, f.b) && on(p.b, f.a)));
  }

  /** Porte et passage vers la pièce voisine, en une étape d'annulation ; le passage est sélectionné. */
  doorTo(f: FacingWalls): boolean {
    const actions = doorBetween(this.plan, f, newId);
    if (!actions) {
      toast('Le mur commun est trop étroit pour une porte de 83 cm.', { tone: 'error' });
      return false;
    }
    this.dispatch({ type: 'batch', actions });
    const passage = actions.at(-1)!;
    if (passage.type === 'plan/passage/add') this.sel = { kind: 'passage', passage: passage.passage.id };
    return true;
  }

  /** Même épaisseur pour tous les murs d'une pièce (une seule étape d'annulation). */
  setRoomThickness(roomId: Id, thickness: number): void {
    const room = this.room(roomId);
    if (!room || !(thickness > 0)) return;
    this.dispatch({
      type: 'batch',
      actions: room.walls
        .filter((w) => w.thickness !== thickness)
        .map((w): ProjectAction => ({ type: 'plan/wall/update', roomId, wallId: w.id, patch: { thickness } })),
    });
  }

  /** Poses touchées si la pièce est supprimée (confirmation) : « Carrelage : « Pose 1 » est supprimée. » */
  roomUsage(id: Id): string[] {
    const p = this.store.get().project;
    return posesInRoom(p, id).map((pose) => {
      const label = moduleById(pose.module)?.label ?? pose.module;
      const elsewhere = p.zones.some((z) => z.pose === pose.id && z.surface.room !== id);
      return `${label} : « ${pose.name} » ${elsewhere ? 'perd cette pièce' : 'est supprimée'}.`;
    });
  }

  /** Suppression demandée (bouton, touche Suppr) : confirmée d'abord si la pièce porte des revêtements. */
  askRemoveRoom(id: Id): void {
    const room = this.room(id);
    if (!room) return;
    const usage = this.roomUsage(id);
    if (usage.length) this.removing = { room, usage };
    else this.removeRoom(id);
  }

  removeRoom(id: Id): void {
    const r = this.room(id);
    if (!r) return;
    this.dispatch({ type: 'plan/room/remove', roomId: id });
    this.sel = null;
    toast(`Pièce « ${r.name} » supprimée.`, { action: undoAction(this.store) });
  }

  /** Nom par défaut d'une nouvelle pièce : « Pièce 2 »… */
  nextRoomName(): string {
    return 'Pièce ' + (this.plan.rooms.length + 1);
  }

  /* ---------- dessin libre ---------- */

  startDraw(): void {
    this.mode = 'draw';
    this.draft = [];
    this.sel = null;
  }

  /** Ajoute un point au dessin ; ferme la pièce si on touche le premier point. */
  drawPoint(p: Point, closeTolerance: number): void {
    const d = this.draft;
    const first = d[0];
    if (first && d.length >= 3 && Math.hypot(p[0] - first[0], p[1] - first[1]) <= closeTolerance) {
      this.closeDraw();
      return;
    }
    const last = d.at(-1);
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    this.draft = [...d, p];
  }

  undoDrawPoint(): void {
    this.draft = this.draft.slice(0, -1);
  }

  /** Pièce du dessin en cours ; null (avec un message) si le contour n'est pas valide. */
  private drawnRoom(name: string): PlanRoom | null {
    const pts = this.draft;
    if (pts.length < 3) {
      toast('Placez au moins 3 points pour fermer la pièce.');
      return null;
    }
    const [ox, oy] = pts.reduce<Point>((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1])], [Infinity, Infinity]);
    const outline: Polygon = clockwise(pts.map(([x, y]) => [x - ox, y - oy]));
    const room = roomFromOutline(outline, { name, origin: [ox, oy], thickness: app.wallThickness }, newId);
    if (Math.abs(signedArea(outline)) < 1) {
      toast('Les points sont alignés : la pièce n’a pas de surface. Déplacez un point.', { tone: 'error' });
      return null;
    }
    if (validateRoom(room).length) {
      toast('Les murs se croisent : déplacez un point ou recommencez.', { tone: 'error' });
      return null;
    }
    return room;
  }

  /** Ferme le dessin : si le contour est valide, demande le nom de la pièce (`naming`). */
  closeDraw(): boolean {
    if (!this.drawnRoom(this.nextRoomName())) return false;
    this.naming = true;
    return true;
  }

  /** Termine le dessin : pièce créée si le contour est valide, sinon message et dessin conservé. */
  finishDraw(name = this.nextRoomName()): boolean {
    this.naming = false;
    const room = this.drawnRoom(name.trim() || this.nextRoomName());
    if (!room) return false;
    this.dispatch({ type: 'plan/room/add', room });
    this.mode = 'select';
    this.draft = [];
    this.sel = { kind: 'room', room: room.id };
    return true;
  }

  cancelDraw(): void {
    this.mode = 'select';
    this.draft = [];
  }

  /* ---------- murs et points ---------- */

  /** Ajoute un point au milieu d'un mur (le mur est coupé en deux). */
  splitWall(roomId: Id, wallId: Id): void {
    const r = this.room(roomId);
    if (!r) return;
    const i = wallIndex(r, wallId);
    const [a, b] = wallSegment(r, i);
    const mid: Point = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
    this.dispatch({ type: 'plan/point/insert', roomId, wallId, point: mid, newWallId: newId() });
    this.sel = { kind: 'point', room: roomId, index: i + 1 };
  }

  removePoint(roomId: Id, index: number): void {
    this.dispatch({ type: 'plan/point/remove', roomId, index });
    this.sel = { kind: 'room', room: roomId };
  }

  /* ---------- ouvertures et obstacles ---------- */

  addOpening(roomId: Id, wallId: Id, kind: OpeningKind): void {
    const r = this.room(roomId);
    if (!r) return;
    const len = wallLength(r, wallIndex(r, wallId));
    const size = OPENING_SIZES[kind];
    const width = Math.min(size.width, Math.max(100, Math.floor(len - 20)));
    const opening: WallOpening = {
      id: newId(),
      kind,
      wall: wallId,
      offset: Math.max(0, Math.round((len - width) / 2)),
      ...size,
      width,
    };
    this.dispatch({ type: 'plan/opening/add', roomId, opening });
    this.sel = { kind: 'opening', room: roomId, opening: opening.id };
  }

  removeOpening(roomId: Id, openingId: Id): void {
    this.dispatch({ type: 'plan/opening/remove', roomId, openingId });
    this.sel = { kind: 'room', room: roomId };
  }

  /** Obstacle ou équipement à sa taille usuelle (`core/plan/equipment`), au centre de la boîte de la pièce. */
  addObstacle(roomId: Id, kind: Obstacle['kind'] = 'post'): void {
    const r = this.room(roomId);
    if (!r) return;
    const xs = r.outline.map((p) => p[0]),
      ys = r.outline.map((p) => p[1]);
    const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2 / 10) * 10,
      cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2 / 10) * 10;
    const { width, depth } = EQUIPMENT[kind];
    const obstacle: Obstacle = {
      id: newId(),
      kind,
      outline: rectAt(cx - Math.round(width / 20) * 10, cy - Math.round(depth / 20) * 10, width, depth),
    };
    this.dispatch({ type: 'plan/obstacle/add', roomId, obstacle });
    this.sel = { kind: 'obstacle', room: roomId, obstacle: obstacle.id };
  }

  /** Redimensionne un obstacle en rectangle largeur × profondeur, coin haut gauche conservé. */
  resizeObstacle(roomId: Id, o: Obstacle, width: number, depth: number): void {
    const [x, y] = o.outline.reduce<Point>(
      (m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1])],
      [Infinity, Infinity],
    );
    this.dispatch({
      type: 'plan/obstacle/update',
      roomId,
      obstacleId: o.id,
      patch: { outline: rectAt(x, y, width, depth) },
    });
  }

  /** Place un obstacle : coin haut-gauche en (x, y), repère de la pièce. */
  moveObstacle(roomId: Id, o: Obstacle, x: number, y: number): void {
    const xs = o.outline.map((p) => p[0]),
      ys = o.outline.map((p) => p[1]);
    this.dispatch({
      type: 'plan/obstacle/update',
      roomId,
      obstacleId: o.id,
      patch: { outline: rectAt(x, y, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) },
    });
  }

  /* ---------- passages ---------- */

  startLink(from: { room: Id; opening: Id }): void {
    this.mode = 'link';
    this.linkFrom = from;
  }

  cancelLink(): void {
    this.mode = 'select';
    this.linkFrom = null;
  }

  /** Relie la porte de départ à `to` : la seconde pièce est déplacée pour que les portes se fassent face. */
  link(to: { room: Id; opening: Id }): boolean {
    const from = this.linkFrom;
    if (!from) return false;
    const r = alignForPassage(this.plan, from, to);
    if ('error' in r) {
      toast(LINK_ERRORS[r.error] ?? 'Ces deux portes ne peuvent pas être reliées.', { tone: 'error' });
      return false;
    }
    const passage = { id: newId(), a: from, b: to };
    this.dispatch({
      type: 'batch',
      actions: [
        { type: 'plan/room/update', roomId: to.room, patch: { origin: r.origin } },
        { type: 'plan/passage/add', passage },
      ],
    });
    this.cancelLink();
    this.sel = { kind: 'passage', passage: passage.id };
    return true;
  }
}

/** Textes courts des refus de travaux (messages complets : ui/lib/planMessages.ts). */
const WORKS_TOAST: Partial<Record<string, string>> = {
  'partition/outside': 'Cloison hors des pièces : ses deux bouts doivent toucher une pièce.',
  'partition/crosses-wall': 'Cette cloison traverse un mur : arrêtez-la contre le mur, ou démolissez-le d’abord.',
  'partition/crosses-locked': 'Cette cloison traverse un mur verrouillé (extérieur ou porteur).',
  'partition/crosses-partition': 'Cette cloison en croise une autre : arrêtez-la contre l’autre.',
  'partition/crosses-obstacle': 'Cette cloison passe dans un poteau ou un conduit.',
  'demolition/no-neighbour': 'Ce mur n’a pas de pièce en face : il est peut-être extérieur.',
};

const LINK_ERRORS: Partial<Record<string, string>> = {
  'passage/missing': 'Choisissez une porte d’une autre pièce.',
  'passage/width': 'Les deux portes doivent avoir la même largeur (à 1 cm près).',
  'passage/not-facing': 'Les deux portes doivent être sur des murs parallèles, face à face.',
};

export const DEFAULT_THICKNESS = DEFAULT_WALL_THICKNESS;

function rectAt(x: number, y: number, w: number, h: number): Polygon {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}
