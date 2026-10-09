/**
 * Règles des zones et des poses (docs/NAVIGATION.md §4), vérifiées avant d'ajouter ou de modifier une zone :
 * surface existante et acceptée par le module, zone non vide, pas de recouvrement sur une même surface, pose qui
 * ne mélange pas sols et murs, étendue d'une pose permise par le module. Pur.
 */
import { intersection, regionArea } from '../geometry/boolean';
import type { Plan, PlanRoom } from '../plan/types';
import { sameSurface, surfaceKey, surfacePolygon, zoneRegion } from './geometry';
import type { CoverageRules, Pose, Zone } from './types';
import type { Id } from '../plan/types';

/** Aire en dessous de laquelle un contact n'est pas un recouvrement (arrondis des booléens), mm². */
const OVERLAP_TOLERANCE = 100;

export type CoverageError =
  | { code: 'surface-missing' }
  | { code: 'surface-unsupported' }
  | { code: 'zone-empty' }
  | { code: 'zone-overlap'; zone: Id }
  | { code: 'pose-mixed' }
  | { code: 'pose-extent' };

export interface Coverage {
  zones: readonly Zone[];
  poses: readonly Pose[];
}

/** Pièces reliées entre elles par les passages du plan (toutes accessibles depuis la première). */
export function roomsConnected(plan: Plan, rooms: readonly Id[]): boolean {
  const want = new Set(rooms);
  if (want.size <= 1) return true;
  const [first] = want;
  const seen = new Set([first!]);
  const todo = [first!];
  while (todo.length) {
    const r = todo.pop()!;
    for (const p of plan.passages) {
      const other = p.a.room === r ? p.b.room : p.b.room === r ? p.a.room : null;
      if (other && want.has(other) && !seen.has(other)) {
        seen.add(other);
        todo.push(other);
      }
    }
  }
  return seen.size === want.size;
}

/**
 * Murs d'une pièce dans l'ordre d'une chaîne continue (sens du contour ; le tour complet part du mur 1), sans
 * doublon ; null si un mur est inconnu ou s'il y a un trou dans la chaîne.
 */
export function wallChain(room: PlanRoom, walls: readonly Id[]): Id[] | null {
  const n = room.walls.length;
  const set = new Set<number>();
  for (const w of walls) {
    const i = room.walls.findIndex((x) => x.id === w);
    if (i < 0) return null;
    set.add(i);
  }
  if (!set.size) return [];
  if (set.size === n) return room.walls.map((w) => w.id);
  const starts = [...set].filter((i) => !set.has((i - 1 + n) % n));
  if (starts.length !== 1) return null;
  return Array.from({ length: set.size }, (_, k) => room.walls[(starts[0]! + k) % n]!.id);
}

/** Suites de murs consécutifs d'une pièce (ordre du contour), pour séparer une chaîne coupée par un trou. */
export function wallRuns(room: PlanRoom, walls: readonly Id[]): Id[][] {
  const n = room.walls.length;
  const set = new Set(walls.map((w) => room.walls.findIndex((x) => x.id === w)).filter((i) => i >= 0));
  if (set.size === n) return [room.walls.map((w) => w.id)];
  const starts = [...set].filter((i) => !set.has((i - 1 + n) % n)).sort((x, y) => x - y);
  return starts.map((s) => {
    const run: Id[] = [];
    for (let i = s; set.has(i) && run.length < n; i = (i + 1) % n) run.push(room.walls[i]!.id);
    return run;
  });
}

/** Groupes de pièces reliées entre elles par les passages du plan (ordre du plan). */
export function roomGroups(plan: Plan, rooms: readonly Id[]): Id[][] {
  const left = plan.rooms.map((r) => r.id).filter((id) => rooms.includes(id));
  const groups: Id[][] = [];
  while (left.length) {
    const group = [left.shift()!];
    for (let k = 0; k < group.length; k++)
      for (const p of plan.passages) {
        const r = group[k]!;
        const other = p.a.room === r ? p.b.room : p.b.room === r ? p.a.room : null;
        const i = other ? left.indexOf(other) : -1;
        if (i >= 0) group.push(...left.splice(i, 1));
      }
    groups.push(plan.rooms.map((r) => r.id).filter((id) => group.includes(id)));
  }
  return groups;
}

/** Zones d'une même pose qui se suivent : sols de pièces reliées, ou murs consécutifs d'une même pièce. */
function continuous(plan: Plan, zones: readonly Zone[]): boolean {
  const rooms = [...new Set(zones.map((o) => o.surface.room))];
  if (zones.every((o) => o.surface.wall == null)) return roomsConnected(plan, rooms);
  const room = rooms.length === 1 ? plan.rooms.find((r) => r.id === rooms[0]) : undefined;
  return (
    !!room &&
    wallChain(
      room,
      zones.map((o) => o.surface.wall!),
    ) != null
  );
}

/**
 * La zone `z` (nouvelle ou modifiée, même identifiant) respecte les règles ; null sinon le premier problème.
 * `rules` : celles du module de la pose de `z`.
 */
export function checkZone(plan: Plan, cov: Coverage, z: Zone, rules: CoverageRules): CoverageError | null {
  if (!surfacePolygon(plan, z.surface)) return { code: 'surface-missing' };
  if (!rules.surfaces.includes(z.surface.wall == null ? 'floor' : 'wall')) return { code: 'surface-unsupported' };
  const region = zoneRegion(plan, z)!;
  if (regionArea(region) < OVERLAP_TOLERANCE) return { code: 'zone-empty' };
  for (const o of cov.zones) {
    if (o.id === z.id || !sameSurface(o.surface, z.surface)) continue;
    const r = zoneRegion(plan, o);
    if (r && regionArea(intersection(region, r)) > OVERLAP_TOLERANCE) return { code: 'zone-overlap', zone: o.id };
  }
  const pose = [...cov.zones.filter((o) => o.pose === z.pose && o.id !== z.id), z];
  const kinds = new Set(pose.map((o) => (o.surface.wall == null ? 'floor' : 'wall')));
  if (kinds.size > 1) return { code: 'pose-mixed' };
  const surfaces = new Set(pose.map((o) => surfaceKey(o.surface)));
  if (rules.extent === 'surface' && surfaces.size > 1) return { code: 'pose-extent' };
  if (rules.extent === 'connected-floors' && !roomsConnected(plan, [...new Set(pose.map((o) => o.surface.room))]))
    return { code: 'pose-extent' };
  if (rules.extent === 'continuous' && !continuous(plan, pose)) return { code: 'pose-extent' };
  return null;
}

/** Zones dont la pièce ou le mur n'existe plus (plan modifié) : ignorées par les calculs, signalées. */
export function orphanZones(plan: Plan, zones: readonly Zone[]): Zone[] {
  return zones.filter((z) => !surfacePolygon(plan, z.surface));
}
