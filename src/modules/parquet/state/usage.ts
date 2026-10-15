/** Lames utilisées par un projet (bibliothèque `boards`). Léger : chargé avec le manifeste du module. */
import type { Id, Project } from '../../../state/model';
import { PARQUET_ID, type ParquetData } from './model';

/** La lame `id` sert-elle à une pose de parquet du projet ? */
export function usesBoard(project: Project, id: Id): boolean {
  const d = project.modules[PARQUET_ID]?.data as ParquetData | undefined;
  return !!d && project.poses.some((p) => p.module === PARQUET_ID && d.poses[p.id]?.boardId === id);
}
