/**
 * Réducteur racine du projet (docs/BOITE.md §5) : `plan/*` vers le plan commun, `pose/*` et `zone/*` vers les
 * zones et poses (core/coverage), `<module>/*` vers le module, renommage et groupes d'actions ici. Les réglages
 * d'une pose arrivent dans son module avec elle et en partent avec elle (événements de pose). Pur ; renvoie le
 * projet d'origine si rien ne change.
 */
import { reduceCoverage, removeRoom, type Coverage, type CoverageAction } from '../core/coverage';
import { reducePlan, type PlanAction } from '../core/plan/reduce';
import type { Plan } from '../core/plan/types';
import { moduleById } from '../modules/registry';
import type { ModuleAction, ModuleId, PoseEvent, ToolModule } from '../modules/types';
import type { ModuleDoc, Project } from './model';

export type ProjectAction =
  | { type: 'project/rename'; name: string }
  /** Active un module : ses données initiales sont créées hors du réducteur (`module.create`). */
  | { type: 'project/module/add'; id: ModuleId; doc: ModuleDoc }
  /** Plusieurs actions en une seule étape d'historique (ex. résultat d'optimisation). */
  | { type: 'batch'; actions: ProjectAction[] }
  | PlanAction
  | CoverageAction
  | ModuleAction;

type Find = (id: ModuleId) => ToolModule | undefined;

export function reduceProject(p: Project, a: ProjectAction, find: Find = moduleById): Project {
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
  if (a.type.startsWith('pose/') || a.type.startsWith('zone/')) {
    const c = a as CoverageAction;
    const cov = reduceCoverage(p.plan, p, c, (m) => find(m)?.coverage);
    if (cov === p || (cov.zones === p.zones && cov.poses === p.poses)) return p;
    const added =
      c.type === 'pose/add'
        ? { id: c.pose.id, settings: c.settings }
        : c.type === 'zone/cut' && c.pose
          ? { id: c.pose.pose.id, settings: c.pose.settings }
          : null;
    return withCoverage(p, cov, added, find);
  }
  if (a.type.startsWith('plan/')) {
    const plan = reducePlan(p.plan, a as PlanAction);
    if (plan === p.plan) return p;
    let next: Project = { ...p, plan };
    if (a.type === 'plan/room/remove') {
      // les zones de la pièce partent avec elle ; les poses restées sans zone aussi (et leurs réglages)
      next = withCoverage(next, removeRoom(next, (a as { roomId: string }).roomId), null, find);
    }
    return next;
  }
  const id = a.type.slice(0, a.type.indexOf('/'));
  return toModule(p, id, a as ModuleAction, p.plan, find);
}

/** Nouvelles zones et poses ; réglages d'une pose ajoutée envoyés à son module, ceux des poses retirées enlevés. */
function withCoverage(p: Project, cov: Coverage, added: { id: string; settings: unknown } | null, find: Find): Project {
  if (cov.zones === p.zones && cov.poses === p.poses) return p;
  let next: Project = { ...p, zones: [...cov.zones], poses: [...cov.poses] };
  const kept = new Set(cov.poses.map((x) => x.id));
  for (const old of p.poses)
    if (!kept.has(old.id)) next = toModule(next, old.module, { type: 'pose/removed', poseId: old.id }, next.plan, find);
  const pose = added && cov.poses.find((x) => x.id === added.id);
  if (pose)
    next = toModule(
      next,
      pose.module,
      { type: 'pose/added', poseId: pose.id, settings: added.settings },
      next.plan,
      find,
    );
  return next;
}

function toModule(p: Project, id: ModuleId, a: ModuleAction | PoseEvent, plan: Plan, find: Find): Project {
  const doc = Object.hasOwn(p.modules, id) ? p.modules[id] : undefined;
  const m = find(id);
  if (!doc || !m) return p;
  const data = m.reduce(doc.data, a, plan);
  return data === doc.data ? p : { ...p, modules: { ...p.modules, [id]: { ...doc, data } } };
}
