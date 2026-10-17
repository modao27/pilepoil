import type { Id } from '../../../core/plan/types';
import type { Project } from '../../../state/model';
import type { Libraries } from '../../types';
import { MACONNERIE_ID, type MaconnerieData } from './model';

/** Le matériau `id` sert-il à un mur du projet ? Léger : chargé avec le manifeste du module. */
export function usesMaterial(project: Project, id: Id, _libraries: Libraries): boolean {
  const d = project.modules[MACONNERIE_ID]?.data as MaconnerieData | undefined;
  return !!d?.walls.some((w) => w.material === id);
}
