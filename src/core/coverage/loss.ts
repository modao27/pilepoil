/**
 * Revêtements perdus quand le plan change (travaux) : par pose, la surface de zones qui n'est plus dans une pièce
 * ou un mur du nouveau plan. Rien n'est supprimé (les zones sont seulement rognées, docs/BOITE.md §3 bis) : ce calcul
 * sert à prévenir avant de valider. Pur ; mm².
 */
import type { Id, Plan } from '../plan/types';
import { zoneArea } from './geometry';
import type { Pose, Zone } from './types';

/** En dessous, la différence n'est qu'un arrondi (0,01 m²). */
const MIN_LOSS = 10_000;

export interface PoseLoss {
  pose: Pose;
  /** Surface de zones perdue, mm². */
  area: number;
}

export function lostByPose(before: Plan, after: Plan, zones: readonly Zone[], poses: readonly Pose[]): PoseLoss[] {
  const by = new Map<Id, number>();
  for (const z of zones) {
    const lost = zoneArea(before, z) - zoneArea(after, z);
    if (lost > MIN_LOSS) by.set(z.pose, (by.get(z.pose) ?? 0) + lost);
  }
  return poses.filter((p) => by.has(p.id)).map((pose) => ({ pose, area: by.get(pose.id)! }));
}
