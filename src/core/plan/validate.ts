/** Validation du plan : des codes, le texte est écrit par l'interface (docs/BOITE.md §3). */
import { EPS } from '../constants';
import { pointInPolygon, signedArea } from '../geometry/polygon';
import type { Point } from '../geometry/types';
import type { Id, Passage, Plan, PlanRoom } from './types';
import { PASSAGE_TOLERANCE, openingCenter, outwardNormal, wallDirection, wallIndex, wallLength } from './walls';

export type PlanErrorCode =
  | 'room/too-few-points'
  | 'room/walls-count'
  | 'room/self-intersecting'
  /** Aire nulle, ou contour en sens antihoraire à l'écran. */
  | 'room/area'
  | 'room/height'
  | 'wall/thickness'
  | 'obstacle/outside'
  | 'opening/wall-missing'
  | 'opening/size'
  | 'opening/outside-wall'
  | 'opening/overlap'
  | 'passage/missing'
  | 'passage/width'
  | 'passage/not-facing';

export interface PlanError {
  code: PlanErrorCode;
  room?: Id;
  /** Mur, ouverture, obstacle ou passage concerné. */
  id?: Id;
}

export function validatePlan(plan: Plan): PlanError[] {
  const errors = plan.rooms.flatMap(validateRoom);
  for (const p of plan.passages) {
    const code = passageError(plan, p.a, p.b);
    if (code) errors.push({ code, id: p.id });
  }
  return errors;
}

export function validateRoom(room: PlanRoom): PlanError[] {
  const out: PlanError[] = [];
  const err = (code: PlanErrorCode, id?: Id) => out.push(id ? { code, room: room.id, id } : { code, room: room.id });
  const pts = room.outline;
  if (pts.length < 3) return [{ code: 'room/too-few-points', room: room.id }];
  if (room.walls.length !== pts.length) return [{ code: 'room/walls-count', room: room.id }];
  if (selfIntersecting(pts)) err('room/self-intersecting');
  else if (signedArea(pts) <= 0) err('room/area');
  if (!(room.height > 0)) err('room/height');
  for (const w of room.walls) if (!(w.thickness > 0)) err('wall/thickness', w.id);
  for (const o of room.obstacles)
    if (o.outline.length < 3 || !o.outline.every((p) => pointInPolygon(p, pts))) err('obstacle/outside', o.id);

  const byWall = new Map<number, [number, number][]>();
  for (const o of room.openings) {
    const i = wallIndex(room, o.wall);
    if (i < 0) {
      err('opening/wall-missing', o.id);
      continue;
    }
    if (!(o.width > 0) || !(o.height > 0) || o.sill < 0) {
      err('opening/size', o.id);
      continue;
    }
    if (o.offset < -EPS || o.offset + o.width > wallLength(room, i) + EPS) err('opening/outside-wall', o.id);
    const spans = byWall.get(i) ?? [];
    if (spans.some(([a, b]) => o.offset < b - EPS && a < o.offset + o.width - EPS)) err('opening/overlap', o.id);
    spans.push([o.offset, o.offset + o.width]);
    byWall.set(i, spans);
  }
  return out;
}

type DoorRef = Passage['a'];

/** Contrôle d'un passage entre deux ouvertures : null si elles se font face. */
export function passageError(plan: Plan, a: DoorRef, b: DoorRef): PlanErrorCode | null {
  const da = door(plan, a),
    db = door(plan, b);
  if (!da || !db || a.room === b.room) return 'passage/missing';
  if (Math.abs(da.width - db.width) > PASSAGE_TOLERANCE) return 'passage/width';
  const target = facingCenter(da);
  if (!target || !antiparallel(da.dir, db.dir)) return 'passage/not-facing';
  return Math.hypot(db.center[0] - target[0], db.center[1] - target[1]) > PASSAGE_TOLERANCE
    ? 'passage/not-facing'
    : null;
}

/**
 * Nouvelle origine de la pièce de `b` pour que sa porte fasse face à celle de `a`, de l'autre côté du mur
 * (distance = épaisseur du mur de `a`). Code d'erreur si les portes ne peuvent pas se faire face.
 */
export function alignForPassage(
  plan: Plan,
  a: DoorRef,
  b: DoorRef,
): { origin: Point } | { error: Exclude<PlanErrorCode, `room/${string}`> } {
  const da = door(plan, a),
    db = door(plan, b);
  if (!da || !db || a.room === b.room) return { error: 'passage/missing' };
  if (Math.abs(da.width - db.width) > PASSAGE_TOLERANCE) return { error: 'passage/width' };
  const target = facingCenter(da);
  if (!target || !antiparallel(da.dir, db.dir)) return { error: 'passage/not-facing' };
  const o = db.room.origin;
  return { origin: [o[0] + target[0] - db.center[0], o[1] + target[1] - db.center[1]] };
}

interface Door {
  room: PlanRoom;
  center: Point;
  dir: Point;
  width: number;
  thickness: number;
}

function door(plan: Plan, ref: DoorRef): Door | null {
  const room = plan.rooms.find((r) => r.id === ref.room);
  const o = room?.openings.find((x) => x.id === ref.opening);
  if (!room || !o) return null;
  const i = wallIndex(room, o.wall);
  const center = openingCenter(room, o);
  if (i < 0 || !center) return null;
  return { room, center, dir: wallDirection(room, i), width: o.width, thickness: room.walls[i]!.thickness };
}

/** Centre attendu de la porte d'en face : de l'autre côté du mur de `d`. */
function facingCenter(d: Door): Point | null {
  if (d.dir[0] === 0 && d.dir[1] === 0) return null;
  const n = outwardNormal(d.dir);
  return [d.center[0] + n[0] * d.thickness, d.center[1] + n[1] * d.thickness];
}

function antiparallel(u: Point, v: Point): boolean {
  return u[0] * v[0] + u[1] * v[1] < -1 + 1e-6;
}

/** Deux segments non adjacents du contour se touchent ou se croisent. */
function selfIntersecting(pts: Point[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsTouch(pts[i]!, pts[(i + 1) % n]!, pts[j]!, pts[(j + 1) % n]!)) return true;
    }
  return false;
}

function orient(a: Point, b: Point, c: Point): number {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return Math.abs(v) < 1e-9 ? 0 : Math.sign(v);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

function segmentsTouch(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c),
    o2 = orient(a, b, d),
    o3 = orient(c, d, a),
    o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && onSegment(a, b, c)) ||
    (o2 === 0 && onSegment(a, b, d)) ||
    (o3 === 0 && onSegment(c, d, a)) ||
    (o4 === 0 && onSegment(c, d, b))
  );
}
