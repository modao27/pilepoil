/**
 * Poses de carrelage : réglages d'une nouvelle pose, hauteur carrelée d'un mur (ligne haute de sa zone),
 * scénario rétabli. Carreler une surface, la continuer ou la retirer se fait sur l'écran Pièce (ui/room/cover).
 * Pur.
 */
import { wallSpanCuts } from '../../../core/coverage/geometry';
import { checkZone, type CoverageError } from '../../../core/coverage/rules';
import type { Cut, Pose, SurfaceRef } from '../../../core/coverage/types';
import type { Plan } from '../../../core/plan/types';
import type { Id, Project } from '../../../state/model';
import { TILE_RULES } from './ids';
import { CARRELAGE_ID, carrelageData, withCarrelage, type CarrelageData } from './data';
import { createPoseSettings } from './factories';
import type { CarrelagePose, Tile } from './model';

export { TILE_RULES };
/**
 * Réglages d'une nouvelle pose : ceux de la pose `like` (bandes copiées avec de nouveaux identifiants), sinon une
 * bande du premier carreau de la bibliothèque (hors références du catalogue, `lm-…`, qui ne servent pas de défaut).
 */
export function newPoseSettings(
  data: CarrelageData | null,
  tiles: readonly Tile[],
  newId: () => Id,
  like?: Id,
): CarrelagePose {
  const base = like && data && Object.hasOwn(data.poses, like) ? data.poses[like]! : null;
  if (!base) return createPoseSettings((tiles.find((t) => !t.id.startsWith('lm-')) ?? tiles[0])?.id ?? '');
  const bands = base.bands.map((b) => ({ ...b, id: newId() }));
  return createPoseSettings(bands[0]!.tileId, {
    joint: base.joint,
    split: base.split,
    bands,
    edgesHidden: base.edgesHidden,
    hiddenEdges: base.hiddenEdges,
  });
}

/** Lignes d'une zone de mur carrelée du sol à `height` (null : jusqu'au plafond, aucune ligne). */
export function wallHeightCuts(plan: Plan, s: SurfaceRef, height: number | null): Cut[] {
  return wallSpanCuts(plan, s, null, height);
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
