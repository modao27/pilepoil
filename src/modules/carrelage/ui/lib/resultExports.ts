/** PDF et 3D du carrelage pour l'écran Résultats commun (chargés à la demande, avec jsPDF et three.js). */
import type { MeshData } from '../../../../render/scene3d/types';
import type { ResultExports, ResultInput } from '../../../types';
import type { Piece, Polygon, ProjectResult } from '../../core';
import { buildMeshes } from '../../render/scene3d/meshes';
import { planLayouts } from '../../render/scene3d/scope';
import { carrelageView, type CarrelageProject } from '../../state/data';
import type { Tile } from '../../state/model';
import { pieceRoom, scopeSurfaces } from '../../state/results';
import { toProjectSpec } from '../../state/selectors';
import { writeTilingResults } from './pdf';
import { scenePhoto } from './photos';

/** Carreaux, joints et plâtre des murs carrelés de la portée, dans le repère du plan. */
export function tilingMeshes(input: ResultInput<ProjectResult>): MeshData[] {
  const view = carrelageView(input.project);
  if (!view) return [];
  const indices = scopeSurfaces(view, input.scope);
  if (!indices.length) return [];
  const spec = toProjectSpec(view, (input.libraries.tiles ?? []) as readonly Tile[]).spec;
  const photo = scenePhoto(view);
  const clip = input.scope.kind === 'room' ? roomClip(view, indices, input.scope.room) : undefined;
  return planLayouts(view.plan, view.surfaces, spec, indices).flatMap((layout) =>
    buildMeshes({
      spec,
      result: input.result,
      layout,
      shade: view.settings.shadeVariation,
      photo,
      context: false,
      ...(clip ? { clip } : {}),
    }),
  );
}

/**
 * Résultats d'une pièce : chaque sol posé aussi dans d'autres pièces est rogné à celle-ci (contour de la pièce au
 * repère de la surface, carreaux dont le centre est dans la pièce).
 */
function roomClip(view: CarrelageProject, indices: readonly number[], roomId: string) {
  const room = view.plan.rooms.find((r) => r.id === roomId);
  if (!room) return undefined;
  const clip: Record<number, { region: Polygon[]; keep: (pc: Piece) => boolean }> = {};
  for (const i of indices) {
    const s = view.surfaces[i]!;
    const part = s.parts.find((p) => p.ref.room === roomId && p.ref.wall == null);
    if (s.kind !== 'floor' || s.parts.length < 2 || !part) continue;
    clip[i] = {
      region: [room.outline.map((q): [number, number] => [q[0] - part.x, q[1] - part.y])],
      keep: (pc) => pieceRoom(view.plan, s, pc) === roomId,
    };
  }
  return clip;
}

export const exports: ResultExports<ProjectResult> = { pdf: writeTilingResults, meshes: tilingMeshes };
