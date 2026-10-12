/**
 * Portée des résultats (docs/NAVIGATION.md §7) : une pose, une pièce ou tout le projet. Quelles poses, quelles
 * pièces et quels murs elle touche. Pur ; unités : mm.
 */
import type { Plan } from '../plan/types';
import { zoneArea } from './geometry';
import type { Pose, Zone } from './types';

type Id = string;

export type ResultScope = { kind: 'pose'; pose: Id } | { kind: 'room'; room: Id } | { kind: 'project' };

interface Covered {
  zones: readonly Zone[];
  poses: readonly Pose[];
}

/** Poses touchées par la portée, dans l'ordre du projet. */
export function scopePoses(cov: Covered, scope: ResultScope): Pose[] {
  if (scope.kind === 'project') return cov.poses.filter((p) => cov.zones.some((z) => z.pose === p.id));
  if (scope.kind === 'pose') return cov.poses.filter((p) => p.id === scope.pose);
  const ids = new Set(cov.zones.filter((z) => z.surface.room === scope.room).map((z) => z.pose));
  return cov.poses.filter((p) => ids.has(p.id));
}

/** Zones de la portée : pour une pièce, seulement celles de la pièce (une pose peut en sortir). */
export function scopeZones(cov: Covered, scope: ResultScope): Zone[] {
  if (scope.kind === 'project') return [...cov.zones];
  if (scope.kind === 'pose') return cov.zones.filter((z) => z.pose === scope.pose);
  return cov.zones.filter((z) => z.surface.room === scope.room);
}

/** Pièces de la portée, dans l'ordre du plan : celles de la pose, la pièce, ou toutes. */
export function scopeRooms(plan: Plan, cov: Covered, scope: ResultScope): Id[] {
  if (scope.kind === 'room') return plan.rooms.some((r) => r.id === scope.room) ? [scope.room] : [];
  if (scope.kind === 'project') return plan.rooms.map((r) => r.id);
  const used = new Set(scopeZones(cov, scope).map((z) => z.surface.room));
  return plan.rooms.filter((r) => used.has(r.id)).map((r) => r.id);
}

/** Murs revêtus dans la portée : dessinés par leur module, pas par l'enveloppe de la 3D. */
export function scopeWalls(cov: Covered, scope: ResultScope): Set<Id> {
  return new Set(scopeZones(cov, scope).flatMap((z) => (z.surface.wall ? [z.surface.wall] : [])));
}

/** La pose sort-elle de la portée (zones dans d'autres pièces) ? */
export function poseBeyond(cov: Covered, pose: Id, scope: ResultScope): boolean {
  if (scope.kind !== 'room') return false;
  return cov.zones.some((z) => z.pose === pose && z.surface.room !== scope.room);
}

/** Surface revêtue par une pose dans la portée, mm². */
export function poseArea(plan: Plan, cov: Covered, pose: Id, scope: ResultScope): number {
  return scopeZones(cov, scope)
    .filter((z) => z.pose === pose)
    .reduce((t, z) => t + zoneArea(plan, z), 0);
}
