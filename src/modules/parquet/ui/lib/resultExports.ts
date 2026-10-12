/** PDF et 3D du parquet pour l'écran Résultats commun (chargés à la demande, avec jsPDF et three.js). */
import type { MeshData } from '../../../../render/scene3d/types';
import type { ResultExports, ResultInput } from '../../../types';
import type { Board } from '../../core/board';
import type { ParquetResult } from '../../core/types';
import { buildParquetMeshes, type ParquetLook } from '../../render/meshes';
import { toSpec } from '../../state/module';
import { layoutsOf } from '../../state/poses';
import { app } from '../../../../ui/lib/app.svelte';
import { writeParquetResults } from './pdf';
import { scopedResult } from './results';

/** Lames et plinthes des poses de la portée, dans le repère du plan (une pièce : ses seules lames). */
export function parquetMeshes(input: ResultInput<ParquetResult>): MeshData[] {
  const r = toSpec(input.project, input.libraries);
  if ('errors' in r) return [];
  const result = scopedResult(input.result, input);
  if (!result.layouts.length) return [];
  const boards = (input.libraries.boards ?? []) as readonly Board[];
  const looks: Record<string, ParquetLook> = Object.fromEntries(
    layoutsOf(input.project).map((l) => {
      const b = boards.find((x) => x.id === l.boardId);
      if (b?.photoId) app.loadPhoto(b.photoId);
      return [
        l.id,
        {
          color: b?.color ?? '#c9a77c',
          photo: (b?.photoId && app.photoUrls[b.photoId]) || null,
          length: Math.max(...(b?.lengths ?? [1000])),
          width: b?.width ?? 100,
        },
      ];
    }),
  );
  const spec = { ...r.spec, layouts: r.spec.layouts.filter((l) => result.layouts.some((x) => x.id === l.id)) };
  const rooms = input.scope.kind === 'room' ? new Set([input.scope.room]) : undefined;
  return buildParquetMeshes({ spec, result, looks, ...(rooms ? { rooms } : {}) });
}

export const exports: ResultExports<ParquetResult> = { pdf: writeParquetResults, meshes: parquetMeshes };
