/** Carreaux utilisés par un projet (bibliothèque `tiles`). Léger : chargé avec le manifeste du module. */
import type { Id, Project } from '../../../state/model';
import type { CarrelageData } from './data';
import { CARRELAGE_ID } from './ids';

/** Le carreau `id` sert-il à une bande d'une pose de carrelage du projet ? */
export function usesTile(project: Project, id: Id): boolean {
  const d = project.modules[CARRELAGE_ID]?.data as CarrelageData | undefined;
  return (
    !!d && project.poses.some((p) => p.module === CARRELAGE_ID && !!d.poses[p.id]?.bands.some((b) => b.tileId === id))
  );
}
