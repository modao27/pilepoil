/**
 * Poses de carrelage : nom et réglages d'une nouvelle pose, actions du projet pour carreler une surface (nouvelle
 * pose, ou suite d'une pose voisine) ou ne plus la carreler (la pose est séparée si elle ne se suit plus),
 * hauteur carrelée d'un mur (ligne haute de sa zone). Pur.
 */
import { sameSurface, surfacePolygon, zoneRegion } from '../../../core/coverage/geometry';
import type { CoverageAction } from '../../../core/coverage/reduce';
import type { Cut, Pose, SurfaceRef, Zone } from '../../../core/coverage/types';
import type { Plan } from '../../../core/plan/types';
import type { Id, Project } from '../../../state/model';
import type { ProjectAction } from '../../../state/project';
import { checkZone, roomGroups, wallRuns, type CoverageError } from '../../../core/coverage/rules';
import { nextPoseName } from '../../../core/coverage/names';
import type { CoverageRules } from '../../../core/coverage/types';
import { CARRELAGE_ID, carrelageData, withCarrelage, type CarrelageData } from './data';

/** Règles des zones de carrelage (aussi déclarées dans le contrat du module). */
export const TILE_RULES: CoverageRules = { surfaces: ['floor', 'wall'], extent: 'continuous' };
import { createPoseSettings } from './factories';
import type { CarrelagePose, Tile } from './model';

/**
 * Réglages d'une nouvelle pose : ceux de la pose `like` (bandes copiées avec de nouveaux identifiants), sinon une
 * bande du premier carreau de la bibliothèque.
 */
export function newPoseSettings(
  data: CarrelageData | null,
  tiles: readonly Tile[],
  newId: () => Id,
  like?: Id,
): CarrelagePose {
  const base = like && data && Object.hasOwn(data.poses, like) ? data.poses[like]! : null;
  if (!base) return createPoseSettings(tiles[0]?.id ?? '');
  const bands = base.bands.map((b) => ({ ...b, id: newId() }));
  return createPoseSettings(bands[0]!.tileId, {
    joint: base.joint,
    split: base.split,
    bands,
    edgesHidden: base.edgesHidden,
    hiddenEdges: base.hiddenEdges,
  });
}

const onSurface = (z: Zone, s: SurfaceRef) => z.surface.room === s.room && z.surface.wall === s.wall;

/** Poses de carrelage posées sur une surface. */
export function tilePosesOn(project: Project, s: SurfaceRef): Pose[] {
  const ids = new Set(project.zones.filter((z) => onSurface(z, s)).map((z) => z.pose));
  return project.poses.filter((p) => p.module === CARRELAGE_ID && ids.has(p.id));
}

/** Action du projet : carreler toute la surface (nouvelle pose, une zone sans découpe). */
export function tileSurfaceAction(
  project: Project,
  surface: SurfaceRef,
  settings: CarrelagePose,
  newId: () => Id,
): Extract<CoverageAction, { type: 'pose/add' }> {
  const pose: Pose = { id: newId(), module: CARRELAGE_ID, name: nextPoseName(project.poses) };
  const zone: Zone = { id: newId(), surface, cuts: [], pose: pose.id };
  return { type: 'pose/add', pose, zones: [zone], settings };
}

/**
 * Poses de carrelage que cette surface peut continuer (même type de surface, mur voisin ou pièce reliée, sans
 * recouvrement), dans l'ordre du projet.
 */
export function continuablePoses(project: Project, surface: SurfaceRef): Pose[] {
  return project.poses.filter((p) => {
    if (p.module !== CARRELAGE_ID) return false;
    const mine = project.zones.filter((z) => z.pose === p.id);
    if (!mine.length || mine.some((z) => (z.surface.wall == null) !== (surface.wall == null))) return false;
    if (mine.some((z) => sameSurface(z.surface, surface))) return false;
    return !checkZone(project.plan, project, { id: '', surface, cuts: [], pose: p.id }, TILE_RULES);
  });
}

/**
 * Action du projet : la surface continue la pose `poseId` (une zone de plus, même calepinage). Un mur reprend la
 * hauteur carrelée du mur voisin de la pose.
 */
export function continuePoseAction(
  project: Project,
  surface: SurfaceRef,
  poseId: Id,
  newId: () => Id,
): Extract<CoverageAction, { type: 'zone/add' }> {
  let cuts: Cut[] = [];
  if (surface.wall != null) {
    const room = project.plan.rooms.find((r) => r.id === surface.room);
    const n = room?.walls.length ?? 0;
    const i = room ? room.walls.findIndex((w) => w.id === surface.wall) : -1;
    const near = room
      ? [room.walls[(i + n - 1) % n]!.id, room.walls[(i + 1) % n]!.id].flatMap((wall) =>
          project.zones.filter((z) => z.pose === poseId && z.surface.room === surface.room && z.surface.wall === wall),
        )
      : [];
    const tops = near.flatMap((z) => (zoneRegion(project.plan, z) ?? []).flat().map((q) => q[1]));
    if (tops.length) cuts = wallHeightCuts(project.plan, surface, Math.max(...tops));
  }
  return { type: 'zone/add', zone: { id: newId(), surface, cuts, pose: poseId } };
}

/** Réglages copiés pour une pose séparée d'une autre : bandes renumérotées, plinthe suivie. */
function cloneSettings(t: CarrelagePose, newId: () => Id): CarrelagePose {
  const ids = new Map(t.bands.map((b) => [b.id, newId()]));
  return {
    ...structuredClone(t),
    bands: t.bands.map((b) => ({ ...structuredClone(b), id: ids.get(b.id)! })),
    plinth: t.plinth ? { ...t.plinth, bandId: ids.get(t.plinth.bandId) ?? t.plinth.bandId } : null,
  };
}

/**
 * Action du projet : ne plus carreler la surface. Ses zones de carrelage sont retirées ; une pose qui ne se suit
 * plus (mur du milieu retiré, pièce de passage retirée) est séparée : la première suite garde la pose, chaque
 * autre devient une nouvelle pose aux mêmes réglages. Une pose sans zone disparaît.
 */
export function untileSurfaceAction(project: Project, surface: SurfaceRef, newId: () => Id): ProjectAction {
  const data = carrelageData(project);
  const actions: ProjectAction[] = [];
  const names = [...project.poses];
  for (const pose of tilePosesOn(project, surface)) {
    const gone = project.zones.filter((z) => z.pose === pose.id && sameSurface(z.surface, surface));
    actions.push(...gone.map((z): ProjectAction => ({ type: 'zone/remove', zoneId: z.id })));
    const left = project.zones.filter((z) => z.pose === pose.id && !sameSurface(z.surface, surface));
    const settings = data && Object.hasOwn(data.poses, pose.id) ? data.poses[pose.id]! : null;
    if (!left.length || !settings) continue;
    const walls = left[0]!.surface.wall != null;
    const room = project.plan.rooms.find((r) => r.id === left[0]!.surface.room);
    const groups: string[][] = walls
      ? room
        ? wallRuns(
            room,
            left.map((z) => z.surface.wall!),
          )
        : []
      : roomGroups(project.plan, [...new Set(left.map((z) => z.surface.room))]);
    for (const g of groups.slice(1)) {
      const moved = left.filter((z) => g.includes(walls ? z.surface.wall! : z.surface.room));
      const added: Pose = { id: newId(), module: CARRELAGE_ID, name: nextPoseName(names) };
      names.push(added);
      actions.push(...moved.map((z): ProjectAction => ({ type: 'zone/remove', zoneId: z.id })));
      actions.push({
        type: 'pose/add',
        pose: added,
        zones: moved.map((z) => ({ ...z, id: newId(), pose: added.id })),
        settings: cloneSettings(settings, newId),
      });
    }
  }
  return { type: 'batch', actions };
}

/** Lignes d'une zone de mur carrelée du sol à `height` (null : jusqu'au plafond, aucune ligne). */
export function wallHeightCuts(plan: Plan, s: SurfaceRef, height: number | null): Cut[] {
  const rect = surfacePolygon(plan, s);
  const ceiling = rect ? Math.max(...rect[0]!.map((p) => p[1])) : Infinity;
  if (height == null || height >= ceiling) return [];
  const length = rect ? Math.max(...rect[0]!.map((p) => p[0])) : 0;
  // côté −1 de la ligne orientée vers +x : sous la ligne (repère du mur, y vers le haut)
  return [
    {
      line: [
        [0, height],
        [length, height],
      ],
      side: -1,
    },
  ];
}

/**
 * Rétablit le carrelage d'un projet figé (scénario) dans le projet actuel : ses poses de carrelage, leurs zones
 * et leurs réglages remplacent ceux d'aujourd'hui ; plan, autres revêtements et le reste sont gardés. Refusé si
 * une zone ne tient plus (surface disparue, recouvrement avec un autre revêtement posé depuis).
 */
export function restoreTiling(current: Project, snapshot: Project): Project | CoverageError {
  const data = carrelageData(snapshot);
  if (!data) return { code: 'surface-missing' };
  const isTile = (p: Pose) => p.module === CARRELAGE_ID;
  const oldIds = new Set(current.poses.filter(isTile).map((p) => p.id));
  const poses = snapshot.poses.filter(isTile);
  const ids = new Set(poses.map((p) => p.id));
  let cov = {
    zones: current.zones.filter((z) => !oldIds.has(z.pose)),
    poses: [...current.poses.filter((p) => !isTile(p)), ...poses],
  };
  for (const z of snapshot.zones.filter((x) => ids.has(x.pose))) {
    const error = checkZone(current.plan, cov, z, TILE_RULES);
    if (error) return error;
    cov = { ...cov, zones: [...cov.zones, z] };
  }
  return { ...withCarrelage(current, data), zones: cov.zones, poses: cov.poses };
}
