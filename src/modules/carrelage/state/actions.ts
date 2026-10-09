import type { Plan } from '../../../core/plan/types';
import type { Id } from '../../../state/model';
import type {
  FloorTiling,
  OpeningFinish,
  ProjectSettings,
  Reservation,
  RoomTiling,
  SurfaceRef,
  TilingBase,
  WallTiling,
  Zone,
} from './model';
import { dataOf, type CarrelageData } from './data';
import { createRoomTiling } from './factories';
import { DEFAULT_FINISH, parseSurfaceId, planWarnings } from './surfaces';

/** Réglages modifiables d'une surface (la géométrie vient du plan ; zones et réservations : actions dédiées). */
export type SurfacePatch = Partial<
  Omit<TilingBase, 'zones' | 'reservations'> &
    Pick<FloorTiling, 'plinth' | 'edgesHidden'> &
    Pick<WallTiling, 'tiledHeight' | 'hiddenEdges'>
>;

/**
 * Actions du carrelage, préfixées par son identifiant (docs/BOITE.md §5). Toutes passent par `reduce`, qui ne
 * modifie jamais son entrée. Les surfaces sont désignées par leur identifiant (`surfaceId`). Renommer le projet et grouper des actions (`batch`) sont des actions du projet.
 */
export type Action =
  | { type: 'carrelage/settings'; patch: Partial<ProjectSettings> }
  | { type: 'carrelage/price'; key: string; value: number | null }
  | { type: 'carrelage/room'; roomId: Id; patch: Partial<Pick<RoomTiling, 'outerCornersCovered'>> }
  | { type: 'carrelage/floor/enable'; roomId: Id; tiling: FloorTiling }
  | { type: 'carrelage/floor/disable'; roomId: Id }
  | { type: 'carrelage/wall/enable'; roomId: Id; wallId: Id; tiling: WallTiling }
  | { type: 'carrelage/wall/disable'; roomId: Id; wallId: Id }
  | { type: 'carrelage/surface/update'; surfaceId: string; patch: SurfacePatch }
  | { type: 'carrelage/zone/add'; surfaceId: string; zone: Zone; index?: number }
  | { type: 'carrelage/zone/remove'; surfaceId: string; zoneId: Id }
  | { type: 'carrelage/zone/update'; surfaceId: string; zoneId: Id; patch: Partial<Omit<Zone, 'id'>> }
  | { type: 'carrelage/zone/move'; surfaceId: string; zoneId: Id; to: number }
  /** Toutes les zones d'une surface (modèle de zones). */
  | { type: 'carrelage/zone/replaceAll'; surfaceId: string; zones: Zone[]; split?: TilingBase['split'] }
  | { type: 'carrelage/reservation/add'; surfaceId: string; reservation: Reservation }
  | { type: 'carrelage/reservation/remove'; surfaceId: string; reservationId: Id }
  | {
      type: 'carrelage/reservation/update';
      surfaceId: string;
      reservationId: Id;
      patch: Partial<Omit<Reservation, 'id'>>;
    }
  /** Finition d'une porte ou fenêtre du plan sur un mur. */
  | { type: 'carrelage/opening/finish'; surfaceId: string; openingId: Id; patch: Partial<OpeningFinish> }
  /** Retire les réglages des pièces et murs qui n'existent plus dans le plan. */
  | { type: 'carrelage/prune' }
  /** Toutes les données (opérations composées, scénario). */
  | { type: 'carrelage/replace'; data: CarrelageData }
  /** Envoyée par le projet quand une pièce du plan est supprimée. */
  | { type: 'plan/room/removed'; roomId: Id };

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  const [it] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, it!);
  return out;
}

function updateById<T extends { id: Id }>(list: readonly T[], id: Id, f: (x: T) => T): T[] {
  let changed = false;
  const out = list.map((x) => {
    if (x.id !== id) return x;
    const y = f(x);
    if (y !== x) changed = true;
    return y;
  });
  return changed ? out : (list as T[]);
}

/** Applique un patch ; renvoie l'objet d'origine si rien ne change (pas d'étape d'historique inutile). */
function patch<T extends object>(x: T, p: Partial<NoInfer<T>>): T {
  const keys = Object.keys(p) as (keyof T)[];
  if (keys.every((k) => Object.is(x[k], p[k]))) return x;
  return { ...x, ...p };
}

const without = <T>(r: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(r).filter(([k]) => k !== key));

function withRoom(d: CarrelageData, roomId: Id, f: (r: RoomTiling) => RoomTiling | null): CarrelageData {
  const old = Object.hasOwn(d.rooms, roomId) ? d.rooms[roomId]! : null;
  const r = f(old ?? createRoomTiling());
  if (r === old) return d;
  // pièce sans rien de carrelé : retirée
  if (!r || (!r.floor && !Object.keys(r.walls).length)) return old ? { ...d, rooms: without(d.rooms, roomId) } : d;
  return { ...d, rooms: { ...d.rooms, [roomId]: r } };
}

/** Applique `f` aux réglages de la surface désignée ; sans effet si elle n'est pas carrelée. */
function withTiling(
  d: CarrelageData,
  ref: SurfaceRef,
  f: <T extends FloorTiling | WallTiling>(t: T) => T,
): CarrelageData {
  const room = Object.hasOwn(d.rooms, ref.room) ? d.rooms[ref.room]! : null;
  if (!room) return d;
  if (ref.wall == null) {
    if (!room.floor) return d;
    const floor = f(room.floor);
    return floor === room.floor ? d : { ...d, rooms: { ...d.rooms, [ref.room]: { ...room, floor } } };
  }
  const wall = Object.hasOwn(room.walls, ref.wall) ? room.walls[ref.wall]! : null;
  if (!wall) return d;
  const next = f(wall);
  if (next === wall) return d;
  return { ...d, rooms: { ...d.rooms, [ref.room]: { ...room, walls: { ...room.walls, [ref.wall]: next } } } };
}

function tilingReduce<T extends FloorTiling | WallTiling>(t: T, a: Action, isWall: boolean): T {
  switch (a.type) {
    case 'carrelage/surface/update': {
      const p = { ...a.patch };
      // réglages propres à l'autre type de surface : ignorés
      if (isWall) {
        delete p.plinth;
        delete p.edgesHidden;
      } else {
        delete p.tiledHeight;
        delete p.hiddenEdges;
      }
      return patch(t, p as Partial<T>);
    }
    case 'carrelage/zone/add': {
      const zones = t.zones.slice();
      zones.splice(a.index ?? zones.length, 0, a.zone);
      return { ...t, zones };
    }
    case 'carrelage/zone/remove': {
      if (t.zones.length <= 1 || !t.zones.some((z) => z.id === a.zoneId)) return t;
      const zones = t.zones.filter((z) => z.id !== a.zoneId);
      if ('plinth' in t && t.plinth?.zoneId === a.zoneId)
        return { ...t, zones, plinth: { ...t.plinth, zoneId: zones[0]!.id } };
      return { ...t, zones };
    }
    case 'carrelage/zone/update': {
      const zones = updateById(t.zones, a.zoneId, (z) => patch(z, a.patch));
      return zones === t.zones ? t : { ...t, zones };
    }
    case 'carrelage/zone/replaceAll': {
      if (!a.zones.length) return t;
      const ids = new Set(a.zones.map((z) => z.id));
      const next = { ...t, zones: a.zones, split: a.split ?? t.split };
      if ('plinth' in next && next.plinth && !ids.has(next.plinth.zoneId))
        return { ...next, plinth: { ...next.plinth, zoneId: a.zones[0]!.id } };
      return next;
    }
    case 'carrelage/zone/move': {
      const from = t.zones.findIndex((z) => z.id === a.zoneId);
      return from < 0 || from === a.to ? t : { ...t, zones: move(t.zones, from, a.to) };
    }
    case 'carrelage/reservation/add':
      return { ...t, reservations: [...t.reservations, a.reservation] };
    case 'carrelage/reservation/remove': {
      const reservations = t.reservations.filter((r) => r.id !== a.reservationId);
      return reservations.length === t.reservations.length ? t : { ...t, reservations };
    }
    case 'carrelage/reservation/update': {
      const reservations = updateById(t.reservations, a.reservationId, (r) => patch(r, a.patch));
      return reservations === t.reservations ? t : { ...t, reservations };
    }
    case 'carrelage/opening/finish': {
      if (!('openings' in t)) return t;
      const old = Object.hasOwn(t.openings, a.openingId) ? t.openings[a.openingId] : undefined;
      const next = patch(old ?? DEFAULT_FINISH, a.patch);
      return next === old ? t : { ...t, openings: { ...t.openings, [a.openingId]: next } };
    }
    default:
      return t;
  }
}

/** Retire les pièces et murs absents du plan. */
function prune(d: CarrelageData, plan: Plan): CarrelageData {
  const warnings = planWarnings(plan, d.rooms);
  if (!warnings.length) return d;
  let rooms = { ...d.rooms };
  for (const w of warnings) {
    if (w.code === 'room-missing') rooms = without(rooms, w.room);
    else if (rooms[w.room]) rooms[w.room] = { ...rooms[w.room]!, walls: without(rooms[w.room]!.walls, w.wall) };
  }
  rooms = Object.fromEntries(Object.entries(rooms).filter(([, r]) => r.floor || Object.keys(r.walls).length));
  return { ...d, rooms };
}

/**
 * Réducteur pur des données carrelage (ou d'une vue `CarrelageProject`, champs communs conservés).
 * Renvoie `d` inchangé (même référence) si l'action est sans effet ou n'est pas une action du carrelage.
 */
export function reduce<P extends CarrelageData>(d: P, a: Action, plan: Plan = { rooms: [], passages: [] }): P {
  switch (a.type) {
    case 'carrelage/settings': {
      const settings = patch(d.settings, a.patch);
      return settings === d.settings ? d : { ...d, settings };
    }
    case 'carrelage/price': {
      const rest = without(d.prices, a.key);
      return { ...d, prices: a.value != null && a.value > 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    case 'carrelage/room':
      return withRoom(d, a.roomId, (r) => patch(r, a.patch)) as P;
    case 'carrelage/floor/enable':
      return withRoom(d, a.roomId, (r) => (r.floor ? r : { ...r, floor: a.tiling })) as P;
    case 'carrelage/floor/disable':
      return withRoom(d, a.roomId, (r) => (r.floor ? { ...r, floor: null } : r)) as P;
    case 'carrelage/wall/enable':
      return withRoom(d, a.roomId, (r) =>
        Object.hasOwn(r.walls, a.wallId) ? r : { ...r, walls: { ...r.walls, [a.wallId]: a.tiling } },
      ) as P;
    case 'carrelage/wall/disable':
      return withRoom(d, a.roomId, (r) =>
        Object.hasOwn(r.walls, a.wallId) ? { ...r, walls: without(r.walls, a.wallId) } : r,
      ) as P;
    case 'plan/room/removed':
      return Object.hasOwn(d.rooms, a.roomId) ? { ...d, rooms: without(d.rooms, a.roomId) } : d;
    case 'carrelage/prune': {
      const next = prune(d, plan);
      return next === d ? d : { ...d, rooms: next.rooms };
    }
    case 'carrelage/replace':
      return { ...d, ...dataOf(a.data) };
    default: {
      const ref = 'surfaceId' in a ? parseSurfaceId(a.surfaceId) : null;
      return ref ? (withTiling(d, ref, (t) => tilingReduce(t, a, ref.wall != null)) as P) : d;
    }
  }
}
