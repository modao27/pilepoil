/** Projet neuf, en mémoire : enregistré seulement avec sa première pièce (pas de projet vide). */
import { emptyPlan } from '../../core/plan/factories';
import { PROJECT_SCHEMA, type Project } from '../../state/model';

export function newProject(now = Date.now()): Project {
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: crypto.randomUUID(),
    name: 'Mon projet',
    createdAt: now,
    updatedAt: now,
    plan: emptyPlan(),
    zones: [],
    poses: [],
    modules: {},
  };
}
