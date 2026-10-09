/**
 * Poses de carrelage : nom et réglages d'une nouvelle pose, actions du projet pour carreler ou non une surface,
 * hauteur carrelée d'un mur (ligne haute de sa zone). Pur.
 */
import { surfacePolygon } from '../../../core/coverage/geometry';
import type { CoverageAction } from '../../../core/coverage/reduce';
import type { Cut, Pose, SurfaceRef, Zone } from '../../../core/coverage/types';
import type { Plan } from '../../../core/plan/types';
import type { Id, Project } from '../../../state/model';
import type { ProjectAction } from '../../../state/project';
import { checkZone, type CoverageError } from '../../../core/coverage/rules';
import { nextPoseName } from '../../../core/coverage/names';
import type { CoverageRules } from '../../../core/coverage/types';
import { CARRELAGE_ID, carrelageData, withCarrelage, type CarrelageData } from './data';

/** Règles des zones de carrelage (aussi déclarées dans le contrat du module). */
export const TILE_RULES: CoverageRules = { surfaces: ['floor', 'wall'], extent: 'surface' };
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

/** Action du projet : ne plus carreler la surface (ses poses de carrelage sont retirées). */
export function untileSurfaceAction(project: Project, surface: SurfaceRef): ProjectAction {
  return {
    type: 'batch',
    actions: tilePosesOn(project, surface).map((p): ProjectAction => ({ type: 'pose/remove', poseId: p.id })),
  };
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
