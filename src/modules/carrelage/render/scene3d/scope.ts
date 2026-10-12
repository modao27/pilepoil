/**
 * Placement 3D des poses de carrelage d'une portée dans le repère du plan (m) : une scène par pièce, chaque sol à
 * sa place, chaque pose de murs depuis son premier mur (repliée à ses angles). Les murs nus et le sol brut sont
 * dessinés par l'enveloppe commune (render/scene3d/envelope).
 */
import type { Plan } from '../../../../core/plan/types';
import { wallDirection, wallIndex, wallSegment } from '../../../../core/plan/walls';
import type { ProjectSpec } from '../../core';
import type { Surface } from '../../state/model';
import { wallFrames, type Instance, type SceneLayout } from './placement';

const m = (v: number) => v / 1000;

/** Scènes des surfaces `indices` (indices du moteur), une par pièce de leur première surface du plan. */
export function planLayouts(
  plan: Plan,
  surfaces: readonly Surface[],
  spec: ProjectSpec,
  indices: readonly number[],
): SceneLayout[] {
  return plan.rooms.flatMap((room): SceneLayout[] => {
    const [ox, oy] = room.origin;
    const instances = indices.flatMap((i): Instance[] => {
      const s = surfaces[i],
        ss = spec.surfaces[i];
      const head = s?.parts[0];
      if (!s || !ss || !head || head.ref.room !== room.id) return [];
      if (s.kind === 'floor') return [{ surface: i, kind: 'floor', origin: [m(ox + head.x), m(oy + head.y)] }];
      const wi = wallIndex(room, head.ref.wall!);
      if (wi < 0) return [];
      const [a] = wallSegment(room, wi);
      const dir = wallDirection(room, wi) as [number, number];
      const start: [number, number] = [m(ox + a[0] + dir[0] * head.x), m(oy + a[1] + dir[1] * head.x)];
      return [{ surface: i, kind: 'wall', frames: wallFrames(ss, start, dir, m(head.y)) }];
    });
    if (!instances.length) return [];
    const xs = room.outline.map((p) => m(ox + p[0])),
      zs = room.outline.map((p) => m(oy + p[1]));
    return [
      {
        instances,
        room: { outline: [], height: m(room.height), bare: [], caps: [] },
        bounds: { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)], h: m(room.height) },
      },
    ];
  });
}
