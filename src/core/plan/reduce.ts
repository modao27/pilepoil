/**
 * Réducteur pur du plan (actions `plan/*`). Ne modifie jamais son entrée ; renvoie le plan d'origine quand
 * rien ne change (pas d'étape d'historique inutile). Les identifiants nouveaux sont fournis par l'action.
 */
import type { Point } from '../geometry/types';
import type { Id, Obstacle, Passage, Plan, PlanRoom, Wall, WallOpening } from './types';
import { parallel, wallDirection, wallIndex, wallLength, wallSegment } from './walls';

type Patch<T> = Partial<Omit<T, 'id'>>;

export type PlanAction =
  | { type: 'plan/replace'; plan: Plan }
  | { type: 'plan/room/add'; room: PlanRoom }
  /** Retire aussi les passages qui la touchent. */
  | { type: 'plan/room/remove'; roomId: Id }
  | { type: 'plan/room/update'; roomId: Id; patch: Partial<Pick<PlanRoom, 'name' | 'height' | 'origin'>> }
  | { type: 'plan/point/move'; roomId: Id; index: number; point: Point }
  /** Ajoute un point sur un mur : le mur est coupé en deux, la seconde moitié prend `newWallId`. */
  | { type: 'plan/point/insert'; roomId: Id; wallId: Id; point: Point; newWallId: Id }
  /** Retire un point (au moins 3 restent) : ses deux murs fusionnent, le premier garde son id. */
  | { type: 'plan/point/remove'; roomId: Id; index: number }
  /** Cote d'un mur : déplace son point d'arrivée et les suivants jusqu'au prochain mur parallèle. */
  | { type: 'plan/wall/length'; roomId: Id; wallId: Id; length: number }
  | { type: 'plan/wall/update'; roomId: Id; wallId: Id; patch: Patch<Wall> }
  | { type: 'plan/opening/add'; roomId: Id; opening: WallOpening }
  | { type: 'plan/opening/update'; roomId: Id; openingId: Id; patch: Patch<WallOpening> }
  /** Retire aussi les passages qui l'utilisent. */
  | { type: 'plan/opening/remove'; roomId: Id; openingId: Id }
  | { type: 'plan/obstacle/add'; roomId: Id; obstacle: Obstacle }
  | { type: 'plan/obstacle/update'; roomId: Id; obstacleId: Id; patch: Patch<Obstacle> }
  | { type: 'plan/obstacle/remove'; roomId: Id; obstacleId: Id }
  | { type: 'plan/passage/add'; passage: Passage }
  | { type: 'plan/passage/remove'; passageId: Id };

export function reducePlan(plan: Plan, a: PlanAction): Plan {
  switch (a.type) {
    case 'plan/replace':
      return a.plan;
    case 'plan/room/add':
      return { ...plan, rooms: [...plan.rooms, a.room] };
    case 'plan/room/remove': {
      if (!plan.rooms.some((r) => r.id === a.roomId)) return plan;
      return {
        rooms: plan.rooms.filter((r) => r.id !== a.roomId),
        passages: plan.passages.filter((p) => p.a.room !== a.roomId && p.b.room !== a.roomId),
      };
    }
    case 'plan/room/update':
      return withRoom(plan, a.roomId, (r) => patch(r, a.patch));
    case 'plan/point/move':
      return withRoom(plan, a.roomId, (r) => {
        const old = r.outline[a.index];
        if (!old || (old[0] === a.point[0] && old[1] === a.point[1])) return r;
        return { ...r, outline: r.outline.map((p, k) => (k === a.index ? a.point : p)) };
      });
    case 'plan/point/insert':
      return withRoom(plan, a.roomId, (r) => insertPoint(r, a.wallId, a.point, a.newWallId));
    case 'plan/point/remove':
      return withRoom(plan, a.roomId, (r) => removePoint(r, a.index));
    case 'plan/wall/length':
      return withRoom(plan, a.roomId, (r) => setWallLength(r, a.wallId, a.length));
    case 'plan/wall/update':
      return withRoom(plan, a.roomId, (r) =>
        withList(
          r,
          'walls',
          updateById(r.walls, a.wallId, (w) => patch(w, a.patch)),
        ),
      );
    case 'plan/opening/add':
      return withRoom(plan, a.roomId, (r) => ({ ...r, openings: [...r.openings, a.opening] }));
    case 'plan/opening/update':
      return withRoom(plan, a.roomId, (r) =>
        withList(
          r,
          'openings',
          updateById(r.openings, a.openingId, (o) => patch(o, a.patch)),
        ),
      );
    case 'plan/opening/remove': {
      const next = withRoom(plan, a.roomId, (r) => withList(r, 'openings', removeById(r.openings, a.openingId)));
      if (next === plan) return plan;
      const uses = (d: Passage['a']) => d.room === a.roomId && d.opening === a.openingId;
      return { ...next, passages: next.passages.filter((p) => !uses(p.a) && !uses(p.b)) };
    }
    case 'plan/obstacle/add':
      return withRoom(plan, a.roomId, (r) => ({ ...r, obstacles: [...r.obstacles, a.obstacle] }));
    case 'plan/obstacle/update':
      return withRoom(plan, a.roomId, (r) =>
        withList(
          r,
          'obstacles',
          updateById(r.obstacles, a.obstacleId, (o) => patch(o, a.patch)),
        ),
      );
    case 'plan/obstacle/remove':
      return withRoom(plan, a.roomId, (r) => withList(r, 'obstacles', removeById(r.obstacles, a.obstacleId)));
    case 'plan/passage/add':
      return { ...plan, passages: [...plan.passages, a.passage] };
    case 'plan/passage/remove': {
      const passages = removeById(plan.passages, a.passageId);
      return passages === plan.passages ? plan : { ...plan, passages };
    }
  }
}

function insertPoint(r: PlanRoom, wallId: Id, point: Point, newWallId: Id): PlanRoom {
  const i = wallIndex(r, wallId);
  if (i < 0) return r;
  const [a] = wallSegment(r, i);
  const u = wallDirection(r, i);
  // distance de coupe : projection du point sur le mur
  const d = Math.max(0, Math.min(wallLength(r, i), (point[0] - a[0]) * u[0] + (point[1] - a[1]) * u[1]));
  const wall = r.walls[i]!;
  return {
    ...r,
    outline: [...r.outline.slice(0, i + 1), point, ...r.outline.slice(i + 1)],
    walls: [...r.walls.slice(0, i + 1), { ...wall, id: newWallId }, ...r.walls.slice(i + 1)],
    // chaque ouverture va sur la moitié qui contient son centre
    openings: r.openings.map((o) =>
      o.wall === wallId && o.offset + o.width / 2 > d ? { ...o, wall: newWallId, offset: o.offset - d } : o,
    ),
  };
}

function removePoint(r: PlanRoom, index: number): PlanRoom {
  const n = r.outline.length;
  if (n <= 3 || index < 0 || index >= n) return r;
  const prev = (index - 1 + n) % n;
  const kept = r.walls[prev]!.id,
    gone = r.walls[index]!.id,
    shift = wallLength(r, prev);
  return {
    ...r,
    outline: r.outline.filter((_, k) => k !== index),
    walls: r.walls.filter((_, k) => k !== index),
    openings: r.openings.map((o) => (o.wall === gone ? { ...o, wall: kept, offset: o.offset + shift } : o)),
  };
}

function setWallLength(r: PlanRoom, wallId: Id, length: number): PlanRoom {
  const i = wallIndex(r, wallId);
  if (i < 0 || !(length > 0)) return r;
  const delta = length - wallLength(r, i);
  if (delta === 0) return r;
  const n = r.outline.length;
  const u = wallDirection(r, i);
  const t: Point = [u[0] * delta, u[1] * delta];
  // points déplacés : de i + 1 jusqu'au début du prochain mur parallèle (le point i ne bouge jamais)
  const moved = new Set<number>();
  for (let k = (i + 1) % n; k !== i; k = (k + 1) % n) {
    moved.add(k);
    if (parallel(wallDirection(r, k), u) || (k + 1) % n === i) break;
  }
  return { ...r, outline: r.outline.map((p, k) => (moved.has(k) ? [p[0] + t[0], p[1] + t[1]] : p)) };
}

/* ---------- aides immuables ---------- */

function withRoom(plan: Plan, roomId: Id, f: (r: PlanRoom) => PlanRoom): Plan {
  const rooms = updateById(plan.rooms, roomId, f);
  return rooms === plan.rooms ? plan : { ...plan, rooms };
}

function withList<K extends 'walls' | 'openings' | 'obstacles'>(r: PlanRoom, key: K, list: PlanRoom[K]): PlanRoom {
  return list === r[key] ? r : { ...r, [key]: list };
}

function updateById<T extends { id: Id }>(list: T[], id: Id, f: (x: T) => T): T[] {
  let changed = false;
  const out = list.map((x) => {
    if (x.id !== id) return x;
    const y = f(x);
    if (y !== x) changed = true;
    return y;
  });
  return changed ? out : list;
}

function removeById<T extends { id: Id }>(list: T[], id: Id): T[] {
  const out = list.filter((x) => x.id !== id);
  return out.length === list.length ? list : out;
}

function patch<T extends object>(x: T, p: Partial<NoInfer<T>>): T {
  const keys = Object.keys(p) as (keyof T)[];
  if (keys.every((k) => Object.is(x[k], p[k]))) return x;
  return { ...x, ...p };
}
