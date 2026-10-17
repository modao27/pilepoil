import type { Id } from '../../../core/plan/types';
import type { Project } from '../../../state/model';
import type { Libraries } from '../../types';

/** Aucun mur de maçonnerie n'utilise encore la bibliothèque (murets multi-matériaux : phase suivante). */
export function usesMaterial(_project: Project, _id: Id, _libraries: Libraries): boolean {
  return false;
}
