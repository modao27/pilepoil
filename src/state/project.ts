/**
 * Réducteur racine du projet (docs/BOITE.md §5) : `plan/*` vers le plan commun, `<module>/*` vers le module,
 * renommage et groupes d'actions ici. Pur ; renvoie le projet d'origine si rien ne change.
 */
import { reducePlan, type PlanAction } from '../core/plan/reduce';
import type { Plan } from '../core/plan/types';
import { moduleById } from '../modules/registry';
import type { ModuleAction, ModuleId, ToolModule } from '../modules/types';
import type { ModuleDoc, Project } from './model';

export type ProjectAction =
  | { type: 'project/rename'; name: string }
  /** Active un module : ses données initiales sont créées hors du réducteur (`module.create`). */
  | { type: 'project/module/add'; id: ModuleId; doc: ModuleDoc }
  /** Plusieurs actions en une seule étape d'historique (ex. résultat d'optimisation). */
  | { type: 'batch'; actions: ProjectAction[] }
  | PlanAction
  | ModuleAction;

/** Action envoyée à chaque module quand une pièce du plan disparaît : il nettoie ses données liées. */
export interface RoomRemoved {
  type: 'plan/room/removed';
  roomId: string;
}

export function reduceProject(
  p: Project,
  a: ProjectAction,
  find: (id: ModuleId) => ToolModule | undefined = moduleById,
): Project {
  if (a.type === 'project/rename') {
    const { name } = a as Extract<ProjectAction, { type: 'project/rename' }>;
    return name === p.name ? p : { ...p, name };
  }
  if (a.type === 'project/module/add') {
    const { id, doc } = a as Extract<ProjectAction, { type: 'project/module/add' }>;
    return Object.hasOwn(p.modules, id) ? p : { ...p, modules: { ...p.modules, [id]: doc } };
  }
  if (a.type === 'batch') {
    const { actions } = a as Extract<ProjectAction, { type: 'batch' }>;
    return actions.reduce<Project>((q, x) => reduceProject(q, x, find), p);
  }
  if (a.type.startsWith('plan/')) {
    const plan = reducePlan(p.plan, a as PlanAction);
    if (plan === p.plan) return p;
    let next: Project = { ...p, plan };
    if (a.type === 'plan/room/remove') {
      const removed: RoomRemoved = { type: 'plan/room/removed', roomId: (a as { roomId: string }).roomId };
      for (const id of Object.keys(p.modules)) next = toModule(next, id, removed, plan, find);
    }
    return next;
  }
  const id = a.type.slice(0, a.type.indexOf('/'));
  return toModule(p, id, a as ModuleAction, p.plan, find);
}

function toModule(
  p: Project,
  id: ModuleId,
  a: ModuleAction,
  plan: Plan,
  find: (id: ModuleId) => ToolModule | undefined,
): Project {
  const doc = Object.hasOwn(p.modules, id) ? p.modules[id] : undefined;
  const m = find(id);
  if (!doc || !m) return p;
  const data = m.reduce(doc.data, a, plan);
  return data === doc.data ? p : { ...p, modules: { ...p.modules, [id]: { ...doc, data } } };
}
