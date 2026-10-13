/** PDF et 3D de la peinture pour l'écran Résultats commun (chargés à la demande, avec jsPDF et three.js). */
import { zoneRegion } from '../../../../core/coverage/geometry';
import type { Zone } from '../../../../core/coverage/types';
import { buildWallPaint, type WallPaint } from '../../../../render/scene3d/paint';
import type { MeshData } from '../../../../render/scene3d/types';
import type { ResultExports, ResultInput } from '../../../types';
import type { Paint } from '../../core/paint';
import type { PeintureResult } from '../../core/types';
import { layoutsOf } from '../../state/poses';
import { writePeintureResults } from './pdf';

/** Blanc cassé des modèles types : couleur d'une pose dont la peinture n'a pas de teinte. */
const FALLBACK = '#f4f1ea';

/** Zones de murs peintes de la portée. */
function scopedZones(input: Pick<ResultInput, 'project' | 'scope'>): { zone: Zone; color: string }[] {
  const { project, scope } = input;
  const paints = (input as Partial<ResultInput>).libraries?.paints as readonly Paint[] | undefined;
  return layoutsOf(project)
    .filter((l) => (scope.kind === 'pose' ? l.id === scope.pose : true))
    .flatMap((l) => {
      const color = paints?.find((p) => p.id === l.settings.finish)?.color?.hex ?? FALLBACK;
      return l.zones
        .filter((z) => scope.kind !== 'room' || z.surface.room === scope.room)
        .map((zone) => ({ zone, color }));
    });
}

/** Murs peints de la portée, à la couleur de la peinture, posés sur le plâtre de l'enveloppe. */
export function peintureMeshes(input: ResultInput<PeintureResult>): MeshData[] {
  const { project } = input;
  const parts = scopedZones(input).flatMap(({ zone, color }): WallPaint[] => {
    const region = zoneRegion(project.plan, zone);
    return region?.length && zone.surface.wall
      ? [{ room: zone.surface.room, wall: zone.surface.wall, region, color }]
      : [];
  });
  return buildWallPaint(project.plan, parts);
}

export const exports: ResultExports<PeintureResult> = {
  overlay: true,
  pdf: writePeintureResults,
  meshes: peintureMeshes,
};
