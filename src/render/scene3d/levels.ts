/**
 * Niveaux de sol en 3D (docs/niveaux/SPEC.md) : les maillages que dessinent les modules (carrelage, parquet, peinture)
 * sont à la hauteur 0 ; chacun de leurs triangles est remonté du niveau de la pièce où il se trouve. Repère three.js :
 * x = x du plan, z = y du plan, y vers le haut ; mètres.
 */
import { pointInPolygon } from '../../core/geometry/polygon';
import type { Point } from '../../core/geometry/types';
import { roomFloor } from '../../core/plan/levels';
import type { Id, Plan, PlanRoom } from '../../core/plan/types';
import type { MeshData } from './types';

const abs = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];

/** Distance d'un point au contour d'une pièce, 0 à l'intérieur. */
function distance(room: PlanRoom, p: Point): number {
  const ring = room.outline.map((q) => abs(room, q));
  if (pointInPolygon(p, ring)) return 0;
  let best = Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  });
  return best;
}

/** Niveau (mm) de la pièce de `rooms` la plus proche d'un point du plan (mm) ; 0 sans pièce. */
export function levelAt(plan: Plan, rooms: readonly Id[], x: number, z: number): number {
  const near = plan.rooms
    .filter((r) => rooms.includes(r.id))
    .map((r) => ({ r, d: distance(r, [x, z]) }))
    .sort((p, q) => p.d - q.d)[0];
  return near ? roomFloor(near.r) : 0;
}

/**
 * Remonte chaque triangle de son niveau de sol (celui de la pièce la plus proche de son centre). Sans aucun niveau
 * dans les pièces montrées, les maillages sont rendus tels quels.
 */
export function shiftByLevel(meshes: readonly MeshData[], plan: Plan, rooms: readonly Id[]): MeshData[] {
  if (!plan.rooms.some((r) => rooms.includes(r.id) && roomFloor(r) !== 0)) return [...meshes];
  return meshes.map((d) => {
    const positions = d.positions.slice();
    for (let t = 0; t < positions.length; t += 9) {
      const cx = ((positions[t]! + positions[t + 3]! + positions[t + 6]!) / 3) * 1000,
        cz = ((positions[t + 2]! + positions[t + 5]! + positions[t + 8]!) / 3) * 1000;
      const dy = levelAt(plan, rooms, cx, cz) / 1000;
      if (dy) for (const k of [1, 4, 7]) positions[t + k] = positions[t + k]! + dy;
    }
    return { ...d, positions };
  });
}
