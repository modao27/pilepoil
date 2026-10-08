import type { Corner, Id, Opening, Project, ProjectSettings, Room, Surface, Zone } from '../../../state/model';

type SurfacePatch = Partial<Omit<Surface, 'id' | 'zones' | 'openings' | 'corners'>>;

/** Modifications du projet. Toutes passent par `reduce`, qui ne modifie jamais son entrée. */
export type Action =
  | { type: 'project/rename'; name: string }
  | { type: 'project/settings'; patch: Partial<ProjectSettings> }
  | { type: 'project/price'; key: string; value: number | null }
  | { type: 'project/room'; room: Room | null }
  | { type: 'surface/add'; surface: Surface; index?: number }
  | { type: 'surface/remove'; surfaceId: Id }
  | { type: 'surface/update'; surfaceId: Id; patch: SurfacePatch }
  | { type: 'surface/move'; surfaceId: Id; to: number }
  | { type: 'zone/add'; surfaceId: Id; zone: Zone; index?: number }
  | { type: 'zone/remove'; surfaceId: Id; zoneId: Id }
  | { type: 'zone/update'; surfaceId: Id; zoneId: Id; patch: Partial<Omit<Zone, 'id'>> }
  | { type: 'zone/move'; surfaceId: Id; zoneId: Id; to: number }
  | { type: 'opening/add'; surfaceId: Id; opening: Opening }
  | { type: 'opening/remove'; surfaceId: Id; openingId: Id }
  | { type: 'opening/update'; surfaceId: Id; openingId: Id; patch: Partial<Omit<Opening, 'id'>> }
  | { type: 'corner/add'; surfaceId: Id; corner: Corner }
  | { type: 'corner/remove'; surfaceId: Id; cornerId: Id }
  | { type: 'corner/update'; surfaceId: Id; cornerId: Id; patch: Partial<Omit<Corner, 'id'>> }
  /** Toutes les zones d'une surface (modèle de zones). */
  | { type: 'zone/replaceAll'; surfaceId: Id; zones: Zone[]; split?: Surface['split'] }
  /** Projet entier (opérations composées : pièce complète). */
  | { type: 'project/replace'; project: Project }
  /** Plusieurs actions en une seule étape d'historique (ex. résultat d'optimisation). */
  | { type: 'batch'; actions: Action[] };

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

function withSurface(p: Project, surfaceId: Id, f: (s: Surface) => Surface): Project {
  const surfaces = updateById(p.surfaces, surfaceId, f);
  return surfaces === p.surfaces ? p : { ...p, surfaces };
}

function surfaceReduce(s: Surface, a: Action): Surface {
  switch (a.type) {
    case 'surface/update':
      return patch(s, a.patch);
    case 'zone/add': {
      const zones = s.zones.slice();
      zones.splice(a.index ?? zones.length, 0, a.zone);
      return { ...s, zones };
    }
    case 'zone/remove': {
      if (s.zones.length <= 1 || !s.zones.some((z) => z.id === a.zoneId)) return s;
      const zones = s.zones.filter((z) => z.id !== a.zoneId);
      const plinth = s.plinth?.zoneId === a.zoneId ? { ...s.plinth, zoneId: zones[0]!.id } : s.plinth;
      return { ...s, zones, plinth };
    }
    case 'zone/update': {
      const zones = updateById(s.zones, a.zoneId, (z) => patch(z, a.patch));
      return zones === s.zones ? s : { ...s, zones };
    }
    case 'zone/replaceAll': {
      if (!a.zones.length) return s;
      const ids = new Set(a.zones.map((z) => z.id));
      const plinth = s.plinth && !ids.has(s.plinth.zoneId) ? { ...s.plinth, zoneId: a.zones[0]!.id } : s.plinth;
      return { ...s, zones: a.zones, split: a.split ?? s.split, plinth };
    }
    case 'zone/move': {
      const from = s.zones.findIndex((z) => z.id === a.zoneId);
      return from < 0 || from === a.to ? s : { ...s, zones: move(s.zones, from, a.to) };
    }
    case 'opening/add':
      return { ...s, openings: [...s.openings, a.opening] };
    case 'opening/remove':
      return { ...s, openings: s.openings.filter((o) => o.id !== a.openingId) };
    case 'opening/update': {
      const openings = updateById(s.openings, a.openingId, (o) => patch(o, a.patch));
      return openings === s.openings ? s : { ...s, openings };
    }
    case 'corner/add':
      return { ...s, corners: [...s.corners, a.corner] };
    case 'corner/remove':
      return { ...s, corners: s.corners.filter((c) => c.id !== a.cornerId) };
    case 'corner/update': {
      const corners = updateById(s.corners, a.cornerId, (c) => patch(c, a.patch));
      return corners === s.corners ? s : { ...s, corners };
    }
    default:
      return s;
  }
}

/** Réducteur pur. Renvoie `p` inchangé (même référence) si l'action est sans effet. */
export function reduce(p: Project, a: Action): Project {
  switch (a.type) {
    case 'project/rename':
      return a.name === p.name ? p : { ...p, name: a.name };
    case 'project/settings': {
      const settings = patch(p.settings, a.patch);
      return settings === p.settings ? p : { ...p, settings };
    }
    case 'project/price': {
      const rest = Object.fromEntries(Object.entries(p.prices).filter(([k]) => k !== a.key));
      return { ...p, prices: a.value != null && a.value > 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    case 'project/room':
      return { ...p, room: a.room };
    case 'surface/add': {
      const surfaces = p.surfaces.slice();
      surfaces.splice(a.index ?? surfaces.length, 0, a.surface);
      return { ...p, surfaces };
    }
    case 'surface/remove': {
      if (p.surfaces.length <= 1 || !p.surfaces.some((s) => s.id === a.surfaceId)) return p;
      let room = p.room;
      if (room) {
        const walls = Object.fromEntries(Object.entries(room.walls).filter(([, id]) => id !== a.surfaceId));
        room = Object.keys(walls).length ? { ...room, walls } : null;
      }
      return { ...p, surfaces: p.surfaces.filter((s) => s.id !== a.surfaceId), room };
    }
    case 'surface/move': {
      const from = p.surfaces.findIndex((s) => s.id === a.surfaceId);
      return from < 0 || from === a.to ? p : { ...p, surfaces: move(p.surfaces, from, a.to) };
    }
    case 'project/replace':
      return a.project.id === p.id ? a.project : p;
    case 'batch':
      return a.actions.reduce(reduce, p);
    default:
      return withSurface(p, a.surfaceId, (s) => surfaceReduce(s, a));
  }
}
