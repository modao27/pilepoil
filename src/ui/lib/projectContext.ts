/**
 * Ce que les modules disent du projet aux autres (docs/BOITE.md §2) : rassemblé ici, par le registre, et passé à
 * chaque `toSpec`. Les modules ne s'importent jamais entre eux.
 */
import type { ProjectContext } from '../../core/coverage/wallBase';
import { modules } from '../../modules/registry';
import type { Libraries } from '../../modules/types';
import type { Project } from '../../state/model';

export function projectContext(project: Project, libraries: Libraries): ProjectContext {
  return {
    wallBases: modules.flatMap((m) =>
      Object.hasOwn(project.modules, m.id) ? (m.wallBases?.(project, libraries) ?? []) : [],
    ),
  };
}
