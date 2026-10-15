/** Peintures utilisées par un projet (bibliothèque `paints`). Léger : chargé avec le manifeste du module. */
import type { Id, Project } from '../../../state/model';
import { PEINTURE_ID, type PeintureData } from './model';

/** La peinture `id` sert-elle à une pose du projet (finition, apprêt, enduit, boiseries) ? */
export function usesPaint(project: Project, id: Id): boolean {
  const d = project.modules[PEINTURE_ID]?.data as PeintureData | undefined;
  if (!d) return false;
  return project.poses.some((p) => {
    const s = p.module === PEINTURE_ID ? d.poses[p.id] : undefined;
    return !!s && [s.finish, s.primer, s.filler, s.woodwork.finish, s.woodwork.primer].includes(id);
  });
}
