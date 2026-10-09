/**
 * État de l'éditeur de plan : projet (store + historique commun à tout le projet), sélection, mode
 * (sélection, dessin libre, liaison de deux portes). Toutes les modifications passent par des actions.
 */
import type { Point, Polygon } from '../../core/geometry/types';
import { lRoom, rectRoom, roomFromOutline, uRoom } from '../../core/plan/factories';
import type { PlanAction } from '../../core/plan/reduce';
import { clockwise, placeNewRoom } from '../../core/plan/snap';
import type { Id, Obstacle, Plan, PlanRoom, WallOpening } from '../../core/plan/types';
import { alignForPassage, validatePlan, validateRoom, type PlanError } from '../../core/plan/validate';
import { DEFAULT_WALL_THICKNESS, wallIndex, wallLength, wallSegment } from '../../core/plan/walls';
import type { Project } from '../../state/model';
import { reduceProject, type ProjectAction } from '../../state/project';
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
  | null;

export type Shape =
  | { kind: 'rect'; length: number; width: number }
  | { kind: 'l'; length: number; width: number; cutLength: number; cutWidth: number }
  | { kind: 'u'; length: number; width: number; arm: number; depth: number };

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
  mode = $state<'select' | 'draw' | 'link'>('select');
  /** Dessin libre en cours : points dans le repère du plan d'ensemble. */
  draft = $state.raw<Point[]>([]);
  /** Première porte d'un passage en cours de liaison. */
  linkFrom = $state.raw<{ room: Id; opening: Id } | null>(null);

  readonly store: ProjectStore<Project, ProjectAction>;
  private saver: Saver<Project>;

  plan = $derived<Plan>(this.doc.plan);
  errors = $derived<PlanError[]>(validatePlan(this.doc.plan));

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
    this.sel && this.sel.kind !== 'passage' ? this.room(this.sel.room) : undefined,
  );

  select(s: PlanSelection): void {
    this.sel = s;
    if (this.mode === 'link' && s?.kind !== 'opening') this.cancelLink();
  }

  /* ---------- pièces ---------- */

  addRoom(shape: Shape, name: string): void {
    const opts = { name, origin: placeNewRoom(this.plan) };
    const room =
      shape.kind === 'rect'
        ? rectRoom(shape.length, shape.width, opts, newId)
        : shape.kind === 'l'
          ? lRoom(shape.length, shape.width, shape.cutLength, shape.cutWidth, opts, newId)
          : uRoom(shape.length, shape.width, shape.arm, shape.depth, opts, newId);
    this.dispatch({ type: 'plan/room/add', room });
    this.sel = { kind: 'room', room: room.id };
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
      this.finishDraw();
      return;
    }
    const last = d.at(-1);
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    this.draft = [...d, p];
  }

  undoDrawPoint(): void {
    this.draft = this.draft.slice(0, -1);
  }

  /** Termine le dessin : pièce créée si le contour est valide, sinon message et dessin conservé. */
  finishDraw(name = this.nextRoomName()): boolean {
    const pts = this.draft;
    if (pts.length < 3) {
      toast('Placez au moins 3 points pour fermer la pièce.');
      return false;
    }
    const [ox, oy] = pts.reduce<Point>((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1])], [Infinity, Infinity]);
    const outline: Polygon = clockwise(pts.map(([x, y]) => [x - ox, y - oy]));
    const room = roomFromOutline(outline, { name, origin: [ox, oy] }, newId);
    if (validateRoom(room).length) {
      toast('Les murs se croisent : déplacez un point ou recommencez.', { tone: 'error' });
      return false;
    }
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

  /** Obstacle carré de 300 mm au centre de la boîte de la pièce. */
  addObstacle(roomId: Id): void {
    const r = this.room(roomId);
    if (!r) return;
    const xs = r.outline.map((p) => p[0]),
      ys = r.outline.map((p) => p[1]);
    const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2 / 10) * 10,
      cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2 / 10) * 10;
    const obstacle: Obstacle = { id: newId(), kind: 'post', outline: rectAt(cx - 150, cy - 150, 300, 300) };
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
