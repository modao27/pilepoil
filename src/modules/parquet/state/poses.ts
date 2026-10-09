/**
 * Poses de parquet sur les zones du projet (docs/NAVIGATION.md §4) : poses vues par l'éditeur, réglages d'une
 * nouvelle pose, actions du projet pour créer une pose, cocher une pièce, séparer une pose. Pur.
 */
import { halfPlane, zoneRegion } from '../../../core/coverage/geometry';
import { nextPoseName } from '../../../core/coverage/names';
import { checkZone, type CoverageError } from '../../../core/coverage/rules';
import type { CoverageRules, Pose, Zone } from '../../../core/coverage/types';
import { intersection, regionArea } from '../../../core/geometry/boolean';
import type { Point, Segment } from '../../../core/geometry/types';
import type { Id, Project } from '../../../state/model';
import type { ProjectAction } from '../../../state/project';
import type { Board } from '../core/board';
import {
  createPoseSettings,
  DEFAULT_BOARD_ID,
  PARQUET_ID,
  type Layout,
  type ParquetData,
  type ParquetPose,
} from './model';

/** Règles des zones de parquet (aussi déclarées dans le contrat du module). */
export const PARQUET_RULES: CoverageRules = { surfaces: ['floor'], extent: 'connected-floors' };

/** Aire en dessous de laquelle un côté d'une ligne est vide, mm² (1 dm²). */
const EMPTY = 1e4;

export const parquetData = (p: Project): ParquetData | null =>
  (p.modules[PARQUET_ID]?.data as ParquetData | undefined) ?? null;

/** Poses de parquet du projet (ordre du projet) avec leurs réglages et leurs zones de sol. */
export function layoutsOf(project: Project): Layout[] {
  const d = parquetData(project);
  if (!d) return [];
  return project.poses.flatMap((p) => {
    const settings = Object.hasOwn(d.poses, p.id) ? d.poses[p.id]! : null;
    if (p.module !== PARQUET_ID || !settings) return [];
    const zones = project.zones.filter((z) => z.pose === p.id && z.surface.wall == null);
    const used = new Set(zones.map((z) => z.surface.room));
    const rooms = project.plan.rooms.filter((r) => used.has(r.id)).map((r) => r.id);
    return [{ ...settings, id: p.id, name: p.name, rooms, zones }];
  });
}

/**
 * Réglages d'une nouvelle pose : ceux de la pose `like` (sans ses seuils ni son décalage), sinon la lame par
 * défaut, ou la première de la bibliothèque si elle a été supprimée.
 */
export function newPoseSettings(data: ParquetData | null, boards: readonly Board[], like?: Id): ParquetPose {
  const base = like && data && Object.hasOwn(data.poses, like) ? data.poses[like]! : null;
  if (base) return structuredClone({ ...base, breaks: [], offset: [0, 0] });
  const board = boards.find((b) => b.id === DEFAULT_BOARD_ID) ?? boards[0];
  return createPoseSettings({ boardId: board?.id ?? DEFAULT_BOARD_ID }, board);
}

/** Action du projet : nouvelle pose sur le sol entier d'une pièce. */
export function addPoseAction(
  project: Project,
  room: Id,
  settings: ParquetPose,
  newId: () => Id,
): Extract<ProjectAction, { type: 'pose/add' }> {
  const pose: Pose = { id: newId(), module: PARQUET_ID, name: nextPoseName(project.poses) };
  const zone: Zone = { id: newId(), surface: { room, wall: null }, cuts: [], pose: pose.id };
  return { type: 'pose/add', pose, zones: [zone], settings };
}

/**
 * Cocher une pièce : son sol entier rejoint la pose (refusé s'il est déjà couvert ou si la pièce n'est pas reliée
 * aux autres) ; décocher : les zones de la pose dans la pièce sont retirées (la pose disparaît avec sa dernière).
 */
export function toggleRoomAction(
  project: Project,
  poseId: Id,
  room: Id,
  on: boolean,
  newId: () => Id,
): { action: ProjectAction } | { error: CoverageError } {
  if (!on)
    return {
      action: {
        type: 'batch',
        actions: project.zones
          .filter((z) => z.pose === poseId && z.surface.room === room && z.surface.wall == null)
          .map((z): ProjectAction => ({ type: 'zone/remove', zoneId: z.id })),
      },
    };
  const zone: Zone = { id: newId(), surface: { room, wall: null }, cuts: [], pose: poseId };
  const error = checkZone(project.plan, project, zone, PARQUET_RULES);
  return error ? { error } : { action: { type: 'zone/add', zone } };
}

/** Ligne du plan vers le repère d'une pièce. */
const toRoom = (line: Segment, origin: Point): Segment =>
  line.map((p) => [p[0] - origin[0], p[1] - origin[1]]) as Segment;

/**
 * Séparer une pose le long d'une ligne du plan (prolongée à l'infini) : chaque zone traversée est coupée (la pose
 * garde le côté 1), les zones entièrement du côté −1 passent dans une nouvelle pose aux mêmes réglages. Un seuil
 * posé sur la ligne devient la limite. null : la ligne ne sépare rien. `poseId` : la nouvelle pose.
 */
export function splitPoseAction(
  project: Project,
  poseId: Id,
  line: Segment,
  settings: ParquetPose,
  newId: () => Id,
): { action: ProjectAction; poseId: Id } | null {
  const moved: Zone[] = [];
  const kept: ProjectAction[] = [];
  let stays = false;
  const pose: Pose = { id: newId(), module: PARQUET_ID, name: nextPoseName(project.poses) };
  for (const z of project.zones) {
    if (z.pose !== poseId || z.surface.wall != null) continue;
    const room = project.plan.rooms.find((r) => r.id === z.surface.room);
    const region = room && zoneRegion(project.plan, z);
    if (!room || !region?.length) continue;
    const local = toRoom(line, room.origin);
    const side = (s: 1 | -1) => regionArea(intersection(region, [halfPlane({ line: local, side: s })]));
    const a = side(1),
      b = side(-1);
    if (b < EMPTY) {
      stays = true;
    } else if (a < EMPTY) {
      kept.push({ type: 'zone/remove', zoneId: z.id });
      moved.push({ ...z, id: newId(), pose: pose.id });
    } else {
      stays = true;
      kept.push({ type: 'zone/update', zoneId: z.id, cuts: [...z.cuts, { line: local, side: 1 }] });
      moved.push({ ...z, id: newId(), cuts: [...z.cuts, { line: local, side: -1 }], pose: pose.id });
    }
  }
  if (!stays || !moved.length) return null;
  const same = (s: Segment) =>
    s.every((p, i) => Math.abs(p[0] - line[i]![0]) < 0.5 && Math.abs(p[1] - line[i]![1]) < 0.5);
  const breaks = settings.breaks.filter((s) => !same(s));
  const action: ProjectAction = {
    type: 'batch',
    actions: [
      ...(breaks.length !== settings.breaks.length
        ? [{ type: 'parquet/pose/update', poseId, patch: { breaks } } as ProjectAction]
        : []),
      ...kept,
      { type: 'pose/add', pose, zones: moved, settings: { ...structuredClone(settings), breaks } },
    ],
  };
  return { action, poseId: pose.id };
}
