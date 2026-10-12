/**
 * Portée des résultats (docs/NAVIGATION.md §7) : une pose, une pièce ou tout le projet. Quelles poses, quelles
 * pièces et quels murs elle touche. Pur ; unités : mm.
 */
import type { Plan } from '../plan/types';
import { zoneArea, zoneBox } from './geometry';
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

/**
 * Parties de murs revêtues dans la portée, par mur : intervalles le long du mur (mm, triés, fusionnés). Le module
 * les dessine du sol au plafond (plâtre compris) ; l'enveloppe de la 3D dessine le reste du mur.
 */
export function scopeWallSpans(plan: Plan, cov: Covered, scope: ResultScope): Map<Id, [number, number][]> {
  const out = new Map<Id, [number, number][]>();
  for (const z of scopeZones(cov, scope)) {
    if (!z.surface.wall) continue;
    const b = zoneBox(plan, z);
    if (!b) continue;
    out.set(z.surface.wall, [...(out.get(z.surface.wall) ?? []), [b[0], b[1]]]);
  }
  for (const [w, spans] of out) {
    const merged: [number, number][] = [];
    for (const s of spans.sort((x, y) => x[0] - y[0])) {
      const last = merged.at(-1);
      if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]);
      else merged.push([s[0], s[1]]);
    }
    out.set(w, merged);
  }
  return out;
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
