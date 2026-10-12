/**
 * Actions de l'écran Pièce sur les zones et les poses (docs/NAVIGATION.md §5), communes à tous les modules :
 * revêtir une surface (nouvelle pose, ou suite d'une pose voisine), changer le revêtement d'une zone, découper un
 * sol par une ligne, régler la hauteur d'une zone de mur. Pures : elles rendent une action du projet, ou l'erreur
 * de zone qui l'empêche.
 */
import {
  checkZone,
  continuablePoses,
  nextPoseName,
  roomGroups,
  wallRuns,
  sameSurface,
  wallSpanCuts,
  zoneBox,
  type CoverageError,
  type Cut,
  type Pose,
  type SurfaceRef,
  type Zone,
} from '../../core/coverage';
import type { Segment } from '../../core/geometry/types';
import { modules } from '../../modules/registry';
import type { Libraries, ToolModule } from '../../modules/types';
import type { Id, Project } from '../../state/model';
import type { ProjectAction } from '../../state/project';

/** Modules qui posent sur ce type de surface (ordre du registre). */
export const modulesFor = (s: SurfaceRef): ToolModule[] =>
  modules.filter((m) => m.coverage.surfaces.includes(s.wall == null ? 'floor' : 'wall'));

/** Zones posées sur une surface, dans l'ordre du projet. */
export const zonesOn = (p: Project, s: SurfaceRef): Zone[] => p.zones.filter((z) => sameSurface(z.surface, s));

/** Poses du module que la surface peut continuer (mur voisin, pièce reliée). */
export const continuable = (p: Project, s: SurfaceRef, m: ToolModule): Pose[] =>
  continuablePoses(p.plan, p, s, m.id, m.coverage);

/** Le module est-il déjà dans le projet ? Sinon, l'action qui l'ajoute. */
function withModule(p: Project, m: ToolModule): { project: Project; actions: ProjectAction[] } {
  if (Object.hasOwn(p.modules, m.id)) return { project: p, actions: [] };
  const doc = { schemaVersion: m.schemaVersion, data: m.create(p.plan) };
  return {
    project: { ...p, modules: { ...p.modules, [m.id]: doc } },
    actions: [{ type: 'project/module/add', id: m.id, doc }],
  };
}

/**
 * Nouvelle pose du module sur une zone (toute la surface si `cuts` est vide). Ses réglages reprennent la dernière
 * pose du module dans la pièce, sinon les réglages par défaut. Erreur si la zone n'est pas permise.
 */
export function newPoseAction(
  p: Project,
  libraries: Libraries,
  m: ToolModule,
  surface: SurfaceRef,
  newId: () => Id,
  cuts: Cut[] = [],
): { action: ProjectAction; poseId: Id } | { error: CoverageError } {
  const pose: Pose = { id: newId(), module: m.id, name: nextPoseName(p.poses) };
  const zone: Zone = { id: newId(), surface, cuts, pose: pose.id };
  const error = checkZone(p.plan, p, zone, m.coverage);
  if (error) return { error };
  const inRoom = new Set(p.zones.filter((z) => z.surface.room === surface.room).map((z) => z.pose));
  const like = [...p.poses].reverse().find((x) => x.module === m.id && inRoom.has(x.id))?.id;
  const { project, actions } = withModule(p, m);
  const settings = m.createPose(project, libraries, like);
  return {
    action: { type: 'batch', actions: [...actions, { type: 'pose/add', pose, zones: [zone], settings }] },
    poseId: pose.id,
  };
}

/**
 * La surface entière continue la pose `poseId`. Un mur reprend la hauteur (de … à …) de la zone de la pose sur le
 * mur voisin.
 */
export function continueAction(p: Project, surface: SurfaceRef, poseId: Id, newId: () => Id): ProjectAction {
  let cuts: Cut[] = [];
  const room = p.plan.rooms.find((r) => r.id === surface.room);
  if (room && surface.wall != null) {
    const n = room.walls.length;
    const i = room.walls.findIndex((w) => w.id === surface.wall);
    const near = [room.walls[(i + n - 1) % n]!.id, room.walls[(i + 1) % n]!.id];
    const z = p.zones.find((x) => x.pose === poseId && x.surface.room === room.id && near.includes(x.surface.wall!));
    const box = z && zoneBox(p.plan, z);
    if (box) cuts = wallSpanCuts(p.plan, surface, box[2], box[3]);
  }
  return { type: 'zone/add', zone: { id: newId(), surface, cuts, pose: poseId } };
}

/**
 * Changer le revêtement d'une zone : elle quitte sa pose (qui garde ses autres zones et ses réglages) et devient
 * une nouvelle pose du module `m`, mêmes limites.
 */
export function switchAction(
  p: Project,
  libraries: Libraries,
  zone: Zone,
  m: ToolModule,
  newId: () => Id,
): { action: ProjectAction; poseId: Id } | { error: CoverageError } {
  const without: Project = { ...p, zones: p.zones.filter((z) => z.id !== zone.id) };
  const r = newPoseAction(without, libraries, m, zone.surface, newId, zone.cuts);
  if ('error' in r) return r;
  return { action: { type: 'batch', actions: [{ type: 'zone/remove', zoneId: zone.id }, r.action] }, poseId: r.poseId };
}

/** Découpe une zone de sol par une ligne (repère de la pièce) : deux zones de la même pose. */
export function cutAction(zone: Zone, line: Segment, newId: () => Id): ProjectAction {
  return { type: 'zone/cut', zoneId: zone.id, line, newZoneId: newId() };
}

/** Hauteur d'une zone de mur : de `from` à `to` mm au-dessus du sol (null : sol, plafond). */
export function spanAction(p: Project, zone: Zone, from: number | null, to: number | null): ProjectAction {
  return { type: 'zone/update', zoneId: zone.id, cuts: wallSpanCuts(p.plan, zone.surface, from, to) };
}

/**
 * Retirer une zone : elle quitte sa pose. Une pose qui ne se suit plus (mur du milieu, pièce de passage) est
 * séparée : la première suite garde la pose, chaque autre devient une nouvelle pose du même module, aux réglages
 * repris (`createPose` avec la pose d'origine). Une pose sans zone disparaît.
 */
export function removeZoneAction(p: Project, libraries: Libraries, zone: Zone, newId: () => Id): ProjectAction {
  const actions: ProjectAction[] = [{ type: 'zone/remove', zoneId: zone.id }];
  const pose = p.poses.find((x) => x.id === zone.pose);
  const m = pose && modules.find((x) => x.id === pose.module);
  const left = p.zones.filter((z) => z.pose === zone.pose && z.id !== zone.id);
  if (!pose || !m || !left.length) return { type: 'batch', actions };
  const walls = left[0]!.surface.wall != null;
  const room = p.plan.rooms.find((r) => r.id === left[0]!.surface.room);
  const groups = walls
    ? room
      ? wallRuns(
          room,
          left.map((z) => z.surface.wall!),
        )
      : []
    : roomGroups(p.plan, [...new Set(left.map((z) => z.surface.room))]);
  const names = [...p.poses];
  for (const g of groups.slice(1)) {
    const moved = left.filter((z) => g.includes(walls ? z.surface.wall! : z.surface.room));
    const added: Pose = { id: newId(), module: m.id, name: nextPoseName(names) };
    names.push(added);
    actions.push(...moved.map((z): ProjectAction => ({ type: 'zone/remove', zoneId: z.id })));
    actions.push({
      type: 'pose/add',
      pose: added,
      zones: moved.map((z) => ({ ...z, id: newId(), pose: added.id })),
      settings: m.createPose(p, libraries, pose.id),
    });
  }
  return { type: 'batch', actions };
}
