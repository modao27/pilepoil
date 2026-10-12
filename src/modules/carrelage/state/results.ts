/**
 * Portée des résultats du carrelage (docs/NAVIGATION.md §7) : quelles surfaces du moteur (une par pose) et
 * quelles pièces posées une pose, une pièce ou le projet touche. Un sol posé sur plusieurs pièces est partagé
 * pièce par pièce selon le centre de chaque carreau. Pur ; unités : mm.
 */
import type { ResultScope } from '../../../core/coverage/scope';
import { pointInPolygon } from '../../../core/geometry/polygon';
import type { Plan } from '../../../core/plan/types';
import type { Id } from '../../../state/model';
import type { Piece, ProjectResult } from '../core';
import type { CarrelageProject } from './data';
import type { Surface } from './model';

/** Indices des surfaces du moteur (poses de carrelage) touchées par la portée. */
export function scopeSurfaces(view: Pick<CarrelageProject, 'surfaces'>, scope: ResultScope): number[] {
  return view.surfaces.flatMap((s, i) => {
    if (scope.kind === 'project') return [i];
    if (scope.kind === 'pose') return s.id === scope.pose ? [i] : [];
    return s.parts.some((p) => p.ref.room === scope.room) ? [i] : [];
  });
}

/** Pièce du plan d'une pièce posée : celle de la surface, ou pour un sol sur plusieurs pièces celle de son centre. */
export function pieceRoom(plan: Plan, s: Surface, pc: Piece): Id {
  const first = s.parts[0]!.ref.room;
  if (s.parts.length < 2 || !pc.parts?.length) return first;
  const ring = pc.parts[0]!;
  const c: [number, number] = [
    ring.reduce((t, q) => t + q[0], 0) / ring.length,
    ring.reduce((t, q) => t + q[1], 0) / ring.length,
  ];
  for (const part of s.parts) {
    const room = plan.rooms.find((r) => r.id === part.ref.room);
    if (room && pointInPolygon([c[0] + part.x, c[1] + part.y], room.outline)) return room.id;
  }
  return first;
}

/** Indices (dans `result.pieces`) des pièces posées dans la portée. */
export function scopePieces(
  view: Pick<CarrelageProject, 'surfaces' | 'plan'>,
  result: ProjectResult,
  scope: ResultScope,
): Set<number> {
  const surfaces = new Set(scopeSurfaces(view, scope));
  const out = new Set<number>();
  result.pieces.forEach((pc, i) => {
    if (!surfaces.has(pc.surface)) return;
    const s = view.surfaces[pc.surface];
    if (scope.kind === 'room' && s && pieceRoom(view.plan, s, pc) !== scope.room) return;
    out.add(i);
  });
  return out;
}
