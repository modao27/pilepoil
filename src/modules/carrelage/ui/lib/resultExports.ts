/** PDF et 3D du carrelage pour l'écran Résultats commun (chargés à la demande, avec jsPDF et three.js). */
import type { MeshData } from '../../../../render/scene3d/types';
import type { ResultExports, ResultInput } from '../../../types';
import type { ProjectResult } from '../../core';
import { buildMeshes } from '../../render/scene3d/meshes';
import { planLayouts } from '../../render/scene3d/scope';
import { carrelageView } from '../../state/data';
import type { Tile } from '../../state/model';
import { scopeSurfaces } from '../../state/results';
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
  return planLayouts(view.plan, view.surfaces, spec, indices).flatMap((layout) =>
    buildMeshes({ spec, result: input.result, layout, shade: view.settings.shadeVariation, photo, context: false }),
  );
}

export const exports: ResultExports<ProjectResult> = { pdf: writeTilingResults, meshes: tilingMeshes };
