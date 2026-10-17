/**
 * Actions de la peinture, préfixées par son identifiant (docs/BOITE.md §5). Réducteur pur : renvoie les données
 * d'origine si l'action est sans effet ou ne le concerne pas.
 */
import type { PoseEvent } from '../../types';
import type { PaintPoseSettings } from '../core/types';
import type { PeintureData } from './model';

type Id = string;

export type Action =
  | { type: 'peinture/pose/update'; poseId: Id; patch: Partial<PaintPoseSettings> }
  | { type: 'peinture/price'; key: string; value: number | null };

/** Réglages des poses : arrivent avec une pose de peinture du projet, en partent avec elle. */
export function reduce(d: PeintureData, a: Action | PoseEvent): PeintureData {
  switch (a.type) {
    case 'pose/added':
      return { ...d, poses: { ...d.poses, [a.poseId]: a.settings as PaintPoseSettings } };
    case 'pose/removed': {
      if (!Object.hasOwn(d.poses, a.poseId)) return d;
      const { [a.poseId]: _, ...poses } = d.poses;
      return { ...d, poses };
    }
    case 'peinture/pose/update': {
      const s = Object.hasOwn(d.poses, a.poseId) ? d.poses[a.poseId]! : null;
      const keys = Object.keys(a.patch) as (keyof PaintPoseSettings)[];
      if (!s || keys.every((k) => Object.is(s[k], a.patch[k]))) return d;
      return { ...d, poses: { ...d.poses, [a.poseId]: { ...s, ...a.patch } } };
    }
    case 'peinture/price': {
      const rest = Object.fromEntries(Object.entries(d.prices).filter(([k]) => k !== a.key));
      return { ...d, prices: a.value != null && a.value >= 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    default:
      return d;
  }
}
