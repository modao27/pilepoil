/**
 * Peinture des murs en 3D : parties peintes d'un mur, posées juste devant le plâtre de l'enveloppe, privées des
 * baies. Repère three.js comme l'enveloppe (x = x du plan, z = y du plan, y vers le haut ; mètres).
 */
import { difference } from '../../core/geometry/boolean';
import { components } from '../../core/geometry/rings';
import type { Polygon } from '../../core/geometry/types';
import type { Id, Plan } from '../../core/plan/types';
import { outwardNormal, wallDirection, wallIndex } from '../../core/plan/walls';
import { emptyMesh, linear, shape, wallHoles } from './envelope';
import type { MeshData, Vec3 } from './types';

export interface WallPaint {
  room: Id;
  wall: Id;
  /** Parties peintes dans le repère du mur (x le long du mur, y depuis le sol), mm. */
  region: Polygon[];
  /** Couleur CSS du produit. */
  color: string;
}

/** La peinture est posée à 2 mm devant le plâtre : aucun scintillement, invisible à l'échelle d'une pièce. */
const THICKNESS = 2;

const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export function buildWallPaint(plan: Plan, parts: readonly WallPaint[]): MeshData[] {
  const mesh = emptyMesh('paint');
  for (const part of parts) {
    const room = plan.rooms.find((r) => r.id === part.room);
    const i = room ? wallIndex(room, part.wall) : -1;
    if (!room || i < 0) continue;
    const a: [number, number] = [room.origin[0] + room.outline[i]![0], room.origin[1] + room.outline[i]![1]];
    const u = wallDirection(room, i);
    const out = outwardNormal(u);
    const inward: Vec3 = [-out[0], 0, -out[1]];
    const W = (x: number, y: number): Vec3 => [
      (a[0] + u[0] * x - out[0] * THICKNESS) / 1000,
      y / 1000,
      (a[1] + u[1] * x - out[1] * THICKNESS) / 1000,
    ];
    const col = linear(part.color);
    const holes = wallHoles(room, i).map(([x0, x1, y0, y1]) => rect(x0, y0, x1, y1));
    for (const c of components(difference(part.region, holes)))
      shape(mesh, c.outer, c.holes, (p) => W(p[0], p[1]), inward, col);
  }
  return mesh.positions.length ? [mesh] : [];
}
