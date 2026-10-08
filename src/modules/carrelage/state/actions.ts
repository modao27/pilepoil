import type { Corner, Id, Opening, ProjectSettings, Room, Surface, Zone } from '../../../state/model';
import { dataOf, type CarrelageData } from './data';

type SurfacePatch = Partial<Omit<Surface, 'id' | 'zones' | 'openings' | 'corners'>>;

/**
 * Actions du carrelage, préfixées par son identifiant (docs/BOITE.md §5). Toutes passent par `reduce`, qui ne
 * modifie jamais son entrée. Renommer le projet et grouper des actions (`batch`) sont des actions du projet.
 */
export type Action =
  | { type: 'carrelage/settings'; patch: Partial<ProjectSettings> }
  | { type: 'carrelage/price'; key: string; value: number | null }
  | { type: 'carrelage/room'; room: Room | null }
  | { type: 'carrelage/surface/add'; surface: Surface; index?: number }
  | { type: 'carrelage/surface/remove'; surfaceId: Id }
  | { type: 'carrelage/surface/update'; surfaceId: Id; patch: SurfacePatch }
  | { type: 'carrelage/surface/move'; surfaceId: Id; to: number }
  | { type: 'carrelage/zone/add'; surfaceId: Id; zone: Zone; index?: number }
  | { type: 'carrelage/zone/remove'; surfaceId: Id; zoneId: Id }
  | { type: 'carrelage/zone/update'; surfaceId: Id; zoneId: Id; patch: Partial<Omit<Zone, 'id'>> }
  | { type: 'carrelage/zone/move'; surfaceId: Id; zoneId: Id; to: number }
  | { type: 'carrelage/opening/add'; surfaceId: Id; opening: Opening }
  | { type: 'carrelage/opening/remove'; surfaceId: Id; openingId: Id }
  | { type: 'carrelage/opening/update'; surfaceId: Id; openingId: Id; patch: Partial<Omit<Opening, 'id'>> }
  | { type: 'carrelage/corner/add'; surfaceId: Id; corner: Corner }
  | { type: 'carrelage/corner/remove'; surfaceId: Id; cornerId: Id }
  | { type: 'carrelage/corner/update'; surfaceId: Id; cornerId: Id; patch: Partial<Omit<Corner, 'id'>> }
  /** Toutes les zones d'une surface (modèle de zones). */
  | { type: 'carrelage/zone/replaceAll'; surfaceId: Id; zones: Zone[]; split?: Surface['split'] }
  /** Toutes les données (opérations composées : pièce complète). */
  | { type: 'carrelage/replace'; data: CarrelageData };

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

function withSurface<P extends CarrelageData>(p: P, surfaceId: Id, f: (s: Surface) => Surface): P {
  const surfaces = updateById(p.surfaces, surfaceId, f);
  return surfaces === p.surfaces ? p : { ...p, surfaces };
}

function surfaceReduce(s: Surface, a: Action): Surface {
  switch (a.type) {
    case 'carrelage/surface/update':
      return patch(s, a.patch);
    case 'carrelage/zone/add': {
      const zones = s.zones.slice();
      zones.splice(a.index ?? zones.length, 0, a.zone);
      return { ...s, zones };
    }
    case 'carrelage/zone/remove': {
      if (s.zones.length <= 1 || !s.zones.some((z) => z.id === a.zoneId)) return s;
      const zones = s.zones.filter((z) => z.id !== a.zoneId);
      const plinth = s.plinth?.zoneId === a.zoneId ? { ...s.plinth, zoneId: zones[0]!.id } : s.plinth;
      return { ...s, zones, plinth };
    }
    case 'carrelage/zone/update': {
      const zones = updateById(s.zones, a.zoneId, (z) => patch(z, a.patch));
      return zones === s.zones ? s : { ...s, zones };
    }
    case 'carrelage/zone/replaceAll': {
      if (!a.zones.length) return s;
      const ids = new Set(a.zones.map((z) => z.id));
      const plinth = s.plinth && !ids.has(s.plinth.zoneId) ? { ...s.plinth, zoneId: a.zones[0]!.id } : s.plinth;
      return { ...s, zones: a.zones, split: a.split ?? s.split, plinth };
    }
    case 'carrelage/zone/move': {
      const from = s.zones.findIndex((z) => z.id === a.zoneId);
      return from < 0 || from === a.to ? s : { ...s, zones: move(s.zones, from, a.to) };
    }
    case 'carrelage/opening/add':
      return { ...s, openings: [...s.openings, a.opening] };
    case 'carrelage/opening/remove':
      return { ...s, openings: s.openings.filter((o) => o.id !== a.openingId) };
    case 'carrelage/opening/update': {
      const openings = updateById(s.openings, a.openingId, (o) => patch(o, a.patch));
      return openings === s.openings ? s : { ...s, openings };
    }
    case 'carrelage/corner/add':
      return { ...s, corners: [...s.corners, a.corner] };
    case 'carrelage/corner/remove':
      return { ...s, corners: s.corners.filter((c) => c.id !== a.cornerId) };
    case 'carrelage/corner/update': {
      const corners = updateById(s.corners, a.cornerId, (c) => patch(c, a.patch));
      return corners === s.corners ? s : { ...s, corners };
    }
    default:
      return s;
  }
}

/**
 * Réducteur pur des données carrelage (ou d'une vue `CarrelageProject`, champs communs conservés).
 * Renvoie `p` inchangé (même référence) si l'action est sans effet ou n'est pas une action du carrelage.
 */
export function reduce<P extends CarrelageData>(p: P, a: Action): P {
  switch (a.type) {
    case 'carrelage/settings': {
      const settings = patch(p.settings, a.patch);
      return settings === p.settings ? p : { ...p, settings };
    }
    case 'carrelage/price': {
      const rest = Object.fromEntries(Object.entries(p.prices).filter(([k]) => k !== a.key));
      return { ...p, prices: a.value != null && a.value > 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    case 'carrelage/room':
      return { ...p, room: a.room };
    case 'carrelage/surface/add': {
      const surfaces = p.surfaces.slice();
      surfaces.splice(a.index ?? surfaces.length, 0, a.surface);
      return { ...p, surfaces };
    }
    case 'carrelage/surface/remove': {
      if (p.surfaces.length <= 1 || !p.surfaces.some((s) => s.id === a.surfaceId)) return p;
      let room = p.room;
      if (room) {
        const walls = Object.fromEntries(Object.entries(room.walls).filter(([, id]) => id !== a.surfaceId));
        room = Object.keys(walls).length ? { ...room, walls } : null;
      }
      return { ...p, surfaces: p.surfaces.filter((s) => s.id !== a.surfaceId), room };
    }
    case 'carrelage/surface/move': {
      const from = p.surfaces.findIndex((s) => s.id === a.surfaceId);
      return from < 0 || from === a.to ? p : { ...p, surfaces: move(p.surfaces, from, a.to) };
    }
    case 'carrelage/replace':
      return { ...p, ...dataOf(a.data) };
    default:
      return 'surfaceId' in a ? withSurface(p, a.surfaceId, (s) => surfaceReduce(s, a)) : p;
  }
}
