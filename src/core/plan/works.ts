/**
 * Travaux du plan v3 (docs/BOITE.md §3 bis) : géométrie des bandes, réducteur de `Site` (actions `plan/*` sur
 * l'état existant, `plan/partition/*`, `plan/demolition/*`) et validation en codes. Pur ; mm, repère du plan.
 */
import { difference, intersection, regionArea, type Region } from '../geometry/boolean';
import { bbox, pointInPolygon, signedArea } from '../geometry/polygon';
import type { BBox, Point, Polygon } from '../geometry/types';
import { reducePlan, type PlanAction } from './reduce';
import type { Demolition, Id, Partition, PartitionOpening, PlanRoom, Site } from './types';
import { wallBands, wallDirection, wallIndex, wallLength, wallSegment, outwardNormal } from './walls';
import { sameLevel } from './levels';

export const DEFAULT_PARTITION_THICKNESS = 72;
/** Une cloison plus courte que ça n'en est pas une, mm. */
export const MIN_PARTITION_LENGTH = 100;
/** Une démolition plus courte que ça est refusée, mm. */
export const MIN_DEMOLITION_LENGTH = 100;
/** Bout de cloison qui mord dans un mur ou une autre cloison : portée de l'accroche et longueur ajoutée, mm. */
export const SNAP = 10;
/** Aire en dessous de laquelle un contact n'est pas un recouvrement, mm². */
export const CONTACT_AREA = 100;

export type WorksErrorCode =
  | 'partition/too-short'
  | 'partition/outside'
  | 'partition/crosses-wall'
  | 'partition/crosses-locked'
  | 'partition/crosses-partition'
  | 'partition/crosses-obstacle'
  | 'partition/over-opening'
  | 'partition/opening-size'
  | 'partition/opening-outside'
  | 'partition/opening-overlap'
  | 'demolition/wall-missing'
  | 'demolition/locked'
  | 'demolition/range'
  | 'demolition/no-neighbour'
  /** Les pièces de part et d'autre du mur ne sont pas au même niveau de sol. */
  | 'demolition/level-mismatch'
  | 'derive/sliver'
  | 'derive/invalid-room'
  | 'derive/passage-lost';

export interface WorksIssue {
  code: WorksErrorCode;
  /** Cloison, ouverture, démolition ou pièce concernée. */
  id: Id;
  /** `error` : le travail est ignoré (ou l'ouverture) ; `warning` : calculé, à signaler. */
  severity: 'error' | 'warning';
}

/* ---------- actions ---------- */

type Patch<T> = Partial<Omit<T, 'id'>>;

export type WorksAction =
  | { type: 'plan/partition/add'; partition: Partition }
  | { type: 'plan/partition/update'; partitionId: Id; patch: Patch<Partition> }
  | { type: 'plan/partition/remove'; partitionId: Id }
  | { type: 'plan/partition/opening/add'; partitionId: Id; opening: PartitionOpening }
  | { type: 'plan/partition/opening/update'; partitionId: Id; openingId: Id; patch: Patch<PartitionOpening> }
  | { type: 'plan/partition/opening/remove'; partitionId: Id; openingId: Id }
  | { type: 'plan/demolition/add'; demolition: Demolition }
  | { type: 'plan/demolition/update'; demolitionId: Id; patch: Patch<Demolition> }
  | { type: 'plan/demolition/remove'; demolitionId: Id }
  | { type: 'plan/site/room-name'; roomId: Id; name: string };

export type SiteAction = PlanAction | WorksAction;

export const isWorksAction = (a: { type: string }): a is WorksAction =>
  a.type.startsWith('plan/partition/') || a.type.startsWith('plan/demolition/') || a.type === 'plan/site/room-name';

/** Réducteur de l'état enregistré : `plan/*` agit sur l'état existant. Renvoie `site` si rien ne change. */
export function reduceSite(site: Site, a: SiteAction): Site {
  if (!isWorksAction(a)) {
    const existing = reducePlan(site.existing, a);
    if (existing === site.existing) return site;
    // une pièce supprimée emporte ses démolitions
    const demolitions =
      a.type === 'plan/room/remove' ? site.demolitions.filter((d) => d.room !== a.roomId) : site.demolitions;
    return {
      ...site,
      existing,
      demolitions: demolitions.length === site.demolitions.length ? site.demolitions : demolitions,
    };
  }
  switch (a.type) {
    case 'plan/partition/add':
      return site.partitions.some((p) => p.id === a.partition.id)
        ? site
        : { ...site, partitions: [...site.partitions, a.partition] };
    case 'plan/partition/update':
      return withList(
        site,
        'partitions',
        updateById(site.partitions, a.partitionId, (p) => patch(p, a.patch)),
      );
    case 'plan/partition/remove':
      return withList(site, 'partitions', removeById(site.partitions, a.partitionId));
    case 'plan/partition/opening/add':
      return withList(
        site,
        'partitions',
        updateById(site.partitions, a.partitionId, (p) =>
          p.openings.some((o) => o.id === a.opening.id) ? p : { ...p, openings: [...p.openings, a.opening] },
        ),
      );
    case 'plan/partition/opening/update':
      return withList(
        site,
        'partitions',
        updateById(site.partitions, a.partitionId, (p) => {
          const openings = updateById(p.openings, a.openingId, (o) => patch(o, a.patch));
          return openings === p.openings ? p : { ...p, openings };
        }),
      );
    case 'plan/partition/opening/remove':
      return withList(
        site,
        'partitions',
        updateById(site.partitions, a.partitionId, (p) => {
          const openings = removeById(p.openings, a.openingId);
          return openings === p.openings ? p : { ...p, openings };
        }),
      );
    case 'plan/demolition/add':
      return site.demolitions.some((d) => d.id === a.demolition.id)
        ? site
        : { ...site, demolitions: [...site.demolitions, a.demolition] };
    case 'plan/demolition/update':
      return withList(
        site,
        'demolitions',
        updateById(site.demolitions, a.demolitionId, (d) => patch(d, a.patch)),
      );
    case 'plan/demolition/remove':
      return withList(site, 'demolitions', removeById(site.demolitions, a.demolitionId));
    case 'plan/site/room-name': {
      const name = a.name.trim();
      if ((site.names?.[a.roomId] ?? '') === name) return site;
      const { [a.roomId]: _old, ...rest } = site.names ?? {};
      return { ...site, names: name ? { ...rest, [a.roomId]: name } : rest };
    }
  }
}

function withList<K extends 'partitions' | 'demolitions'>(site: Site, key: K, list: Site[K]): Site {
  return list === site[key] ? site : { ...site, [key]: list };
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

/* ---------- géométrie ---------- */

const sub = (p: Point, q: Point): Point => [p[0] - q[0], p[1] - q[1]];
const dot = (p: Point, q: Point) => p[0] * q[0] + p[1] * q[1];
const at = (o: Point, u: Point, s: number, n: Point, d: number): Point => [
  o[0] + u[0] * s + n[0] * d,
  o[1] + u[1] * s + n[1] * d,
];
const positive = (r: Polygon): Polygon => (signedArea(r) < 0 ? [...r].reverse() : r);

export const absPoint = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];
const outlineMemo = new WeakMap<PlanRoom, Polygon>();
export function absOutline(r: PlanRoom): Polygon {
  let o = outlineMemo.get(r);
  if (!o) outlineMemo.set(r, (o = positive(r.outline.map((p) => absPoint(r, p)))));
  return o;
}

/** Boîtes englobantes [x0, x1, y0, y1] qui se touchent (à `gap` près). */
export const boxesOverlap = (a: BBox, b: BBox, gap = 0): boolean =>
  a[0] <= b[1] + gap && b[0] <= a[1] + gap && a[2] <= b[3] + gap && b[2] <= a[3] + gap;

const reachMemo = new WeakMap<PlanRoom, BBox>();
/** Boîte d'une pièce avec ses murs (le plus loin que touche la pièce). */
export function roomReach(r: PlanRoom): BBox {
  let b = reachMemo.get(r);
  if (!b) reachMemo.set(r, (b = bbox([...absOutline(r), ...absWallBands(r).flat()])));
  return b;
}

/** Repère d'une cloison : axe, direction u, normale gauche nl = (uy, −ux), largeurs de chaque côté de l'axe. */
export interface PartitionFrame {
  a: Point;
  b: Point;
  length: number;
  u: Point;
  nl: Point;
  /** Épaisseur du côté gauche (face a) et du côté droit (face b) de l'axe. */
  wl: number;
  wr: number;
}

export function partitionFrame(q: Partition): PartitionFrame {
  const length = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
  const u: Point = length ? [(q.b[0] - q.a[0]) / length, (q.b[1] - q.a[1]) / length] : [1, 0];
  const wl = q.align === 'center' ? q.thickness / 2 : q.align === 'left' ? q.thickness : 0;
  return { a: q.a, b: q.b, length, u, nl: [u[1], -u[0]], wl, wr: q.thickness - wl };
}

/** Bande de la cloison, prolongée de `extA` et `extB` aux deux bouts. Sens positif. */
export function partitionBand(q: Partition, extA = 0, extB = 0): Polygon {
  const f = partitionFrame(q);
  const s0 = -extA,
    s1 = f.length + extB;
  return positive([
    at(f.a, f.u, s0, f.nl, f.wl),
    at(f.a, f.u, s1, f.nl, f.wl),
    at(f.a, f.u, s1, f.nl, -f.wr),
    at(f.a, f.u, s0, f.nl, -f.wr),
  ]);
}

/** Bande d'une démolition (de la face intérieure à `margin` au-delà de l'épaisseur). Sens positif. */
export function demolitionBand(room: PlanRoom, i: number, from: number, to: number, margin: number): Polygon {
  const [s] = wallSegment(room, i);
  const start = absPoint(room, s);
  const u = wallDirection(room, i);
  const n = outwardNormal(u);
  const t = room.walls[i]!.thickness;
  return positive([
    at(start, u, from, n, -margin),
    at(start, u, to, n, -margin),
    at(start, u, to, n, t + margin),
    at(start, u, from, n, t + margin),
  ]);
}

/** Murs d'une pièce comme bandes dans le repère du plan (une par mur, ordre du contour). */
const bandsMemo = new WeakMap<PlanRoom, Polygon[]>();
export function absWallBands(room: PlanRoom): Polygon[] {
  let b = bandsMemo.get(room);
  if (!b) bandsMemo.set(room, (b = wallBands(room).map((ring) => positive(ring.map((q) => absPoint(room, q))))));
  return b;
}

const area = (r: Region) => Math.abs(regionArea(r));

/* ---------- validation ---------- */

/** Extension d'un bout de cloison : il mord de `SNAP` dans le mur ou la cloison qu'il rejoint. */
export function partitionExtension(site: Site, q: Partition): [number, number] {
  const f = partitionFrame(q);
  const near = (p: Point): boolean => {
    for (const r of site.existing.rooms) {
      if (!boxesOverlap([p[0], p[0], p[1], p[1]], roomReach(r), SNAP)) continue;
      const o = absOutline(r);
      for (let i = 0; i < o.length; i++) if (segDistance(p, o[i]!, o[(i + 1) % o.length]!) <= SNAP) return true;
      for (const b of absWallBands(r)) if (pointInPolygon(p, b)) return true;
    }
    for (const other of site.partitions) {
      if (other.id === q.id) continue;
      const b = partitionBand(other);
      if (pointInPolygon(p, b)) return true;
      for (let i = 0; i < b.length; i++) if (segDistance(p, b[i]!, b[(i + 1) % b.length]!) <= SNAP) return true;
    }
    return false;
  };
  return [near(f.a) ? SNAP : 0, near(f.b) ? SNAP : 0];
}

export function segDistance(p: Point, a: Point, b: Point): number {
  const d = sub(b, a);
  const l2 = dot(d, d);
  const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]);
}

/**
 * Problèmes des travaux. `error` : le travail est ignoré par la dérivation (une ouverture de cloison en erreur est
 * ignorée seule) ; `warning` : calculé et signalé.
 */
export function validateWorks(site: Site): WorksIssue[] {
  const out: WorksIssue[] = [];
  const err = (code: WorksErrorCode, id: Id) => out.push({ code, id, severity: 'error' });
  const rooms = site.existing.rooms;
  const demolished = site.demolitions
    .filter((d) => demolitionIssue(site, d) === null)
    .map((d) => {
      const r = rooms.find((x) => x.id === d.room)!;
      return demolitionBand(r, wallIndex(r, d.wall), d.from, d.to, 0.5);
    });

  for (const d of site.demolitions) {
    const code = demolitionIssue(site, d);
    if (code) err(code, d.id);
  }

  for (const q of site.partitions) {
    const f = partitionFrame(q);
    if (f.length < MIN_PARTITION_LENGTH || !(q.thickness > 0)) {
      err('partition/too-short', q.id);
      continue;
    }
    if (!insideSomeRoom(site, q)) {
      err('partition/outside', q.id);
      continue;
    }
    const crossing = crossedWalls(site, q, demolished);
    if (crossing === 'locked') {
      err('partition/crosses-locked', q.id);
      continue;
    }
    if (crossing === 'wall') {
      err('partition/crosses-wall', q.id);
      continue;
    }
    if (
      rooms.some((r) =>
        r.obstacles.some(
          (o) =>
            area(intersection([positive(o.outline.map((p) => absPoint(r, p)))], [partitionBand(q)])) > CONTACT_AREA,
        ),
      )
    ) {
      err('partition/crosses-obstacle', q.id);
      continue;
    }
    if (site.partitions.some((o) => o.id !== q.id && partitionsCross(q, o))) {
      err('partition/crosses-partition', q.id);
      continue;
    }
    const spans: [number, number][] = [];
    for (const o of q.openings) {
      if (!(o.width > 0) || !(o.height > 0)) err('partition/opening-size', o.id);
      else if (o.offset < 0 || o.offset + o.width > f.length) err('partition/opening-outside', o.id);
      else if (spans.some(([s0, s1]) => o.offset < s1 && s0 < o.offset + o.width))
        err('partition/opening-overlap', o.id);
      else spans.push([o.offset, o.offset + o.width]);
    }
  }
  return out;
}

function demolitionIssue(site: Site, d: Demolition): WorksErrorCode | null {
  const r = site.existing.rooms.find((x) => x.id === d.room);
  const i = r ? wallIndex(r, d.wall) : -1;
  if (!r || i < 0) return 'demolition/wall-missing';
  if (r.walls[i]!.locked) return 'demolition/locked';
  if (!(d.from >= 0) || !(d.to <= wallLength(r, i) + 0.5) || d.to - d.from < MIN_DEMOLITION_LENGTH)
    return 'demolition/range';
  const next = neighborRooms(site, r, i, d);
  if (!next.length) return 'demolition/no-neighbour';
  return next.some((n) => !sameLevel(r, n)) ? 'demolition/level-mismatch' : null;
}

/** Pièces de l'état existant de l'autre côté du mur i, sur l'intervalle de la démolition (tolérance du plan). */
export function neighborRooms(site: Site, room: PlanRoom, i: number, d: Pick<Demolition, 'from' | 'to'>): PlanRoom[] {
  const band = demolitionBand(room, i, d.from, d.to, SNAP);
  return site.existing.rooms.filter(
    (r) => r.id !== room.id && area(intersection([band], [absOutline(r)])) > CONTACT_AREA,
  );
}

/** Les deux bouts de la cloison sont dans une pièce, dans l'épaisseur d'un mur ou à moins de `SNAP` d'une pièce. */
function insideSomeRoom(site: Site, q: Partition): boolean {
  const f = partitionFrame(q);
  const ok = (p: Point) =>
    site.existing.rooms.some((r) => {
      if (!boxesOverlap([p[0], p[0], p[1], p[1]], roomReach(r), SNAP)) return false;
      const o = absOutline(r);
      if (pointInPolygon(p, o)) return true;
      if (absWallBands(r).some((b) => pointInPolygon(p, b))) return true;
      return o.some((v, i) => segDistance(p, v, o[(i + 1) % o.length]!) <= SNAP);
    });
  return ok(f.a) && ok(f.b);
}

/**
 * Le tronçon d'axe qui traverse des murs sans toucher un bout de la cloison : elle les franchit. 'locked' si l'un
 * des murs franchis est verrouillé.
 */
function crossedWalls(site: Site, q: Partition, demolished: Polygon[]): 'locked' | 'wall' | null {
  const f = partitionFrame(q);
  const thin: Polygon = positive([
    at(f.a, f.u, 0, f.nl, 1),
    at(f.a, f.u, f.length, f.nl, 1),
    at(f.a, f.u, f.length, f.nl, -1),
    at(f.a, f.u, 0, f.nl, -1),
  ]);
  const spans: { s0: number; s1: number; locked: boolean }[] = [];
  const box = bbox(thin);
  for (const r of site.existing.rooms)
    absWallBands(r).forEach((band, i) => {
      if (!boxesOverlap(box, bbox(band))) return;
      let hit: Region = intersection([thin], [band]);
      if (demolished.length) hit = difference(hit, demolished);
      if (area(hit) < 1) return;
      const s = hit.flat().map((p) => dot(sub(p, f.a), f.u));
      spans.push({ s0: Math.min(...s), s1: Math.max(...s), locked: !!r.walls[i]!.locked });
    });
  spans.sort((x, y) => x.s0 - y.s0);
  // fusion des tronçons qui se touchent (angle, deux murs côte à côte)
  const merged: { s0: number; s1: number; locked: boolean }[] = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s.s0 <= last.s1 + 2) {
      last.s1 = Math.max(last.s1, s.s1);
      last.locked ||= s.locked;
    } else merged.push({ ...s });
  }
  const bad = merged.filter((m) => m.s0 > 1 && m.s1 < f.length - 1);
  if (!bad.length) return null;
  return bad.some((m) => m.locked) ? 'locked' : 'wall';
}

/** Deux cloisons qui se croisent (leurs axes se coupent à l'intérieur des deux) ou se superposent. */
function partitionsCross(p: Partition, q: Partition): boolean {
  const a = partitionFrame(p),
    b = partitionFrame(q);
  const den = a.u[0] * b.u[1] - a.u[1] * b.u[0];
  const d = sub(b.a, a.a);
  const slack = Math.max(p.thickness, q.thickness);
  if (Math.abs(den) < 1e-9) {
    // parallèles : superposées si alignées (écart < épaisseur) et recouvrement le long de l'axe
    const gap = Math.abs(d[0] * a.u[1] - d[1] * a.u[0]);
    if (gap >= Math.min(p.thickness, q.thickness)) return false;
    const s0 = dot(d, a.u),
      s1 = dot(sub(b.b, a.a), a.u);
    return Math.min(a.length, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) > slack;
  }
  const s = (d[0] * b.u[1] - d[1] * b.u[0]) / den;
  const t = (d[0] * a.u[1] - d[1] * a.u[0]) / den;
  // un bout qui tombe dans l'épaisseur de l'autre est une liaison (T, angle), pas un croisement
  return s > slack && s < a.length - slack && t > slack && t < b.length - slack;
}
