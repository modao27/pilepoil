/**
 * Actions du parquet, préfixées par son identifiant (docs/BOITE.md §5). Réducteur pur : renvoie les données
 * d'origine si l'action est sans effet ou ne le concerne pas.
 */
import type { PoseEvent } from '../../types';
import type { Accessories, ParquetSettings } from '../core/types';
import type { ParquetData, ParquetPose } from './model';

type Id = string;

export type Action =
  | { type: 'parquet/pose/update'; poseId: Id; patch: Partial<ParquetPose> }
  | { type: 'parquet/settings'; patch: Partial<ParquetSettings> }
  | { type: 'parquet/accessories'; patch: Partial<Accessories> }
  | { type: 'parquet/price'; key: string; value: number | null }
  /** Chantier : pièces posées (ou plus) pour le calcul d'empreinte `hash`. */
  | { type: 'parquet/worksite/mark'; hash: string; ids: string[]; done: boolean }
  /** Chantier : le calcul a changé ; on garde les pièces cochées qui existent encore (`valid`), ou rien. */
  | { type: 'parquet/worksite/rebase'; hash: string; valid: string[] };

/** Réglages des poses : arrivent avec une pose de parquet du projet, en partent avec elle. */
export function reduce(d: ParquetData, a: Action | PoseEvent): ParquetData {
  switch (a.type) {
    case 'pose/added':
      return { ...d, poses: { ...d.poses, [a.poseId]: a.settings as ParquetPose } };
    case 'pose/removed': {
      if (!Object.hasOwn(d.poses, a.poseId)) return d;
      const { [a.poseId]: _, ...poses } = d.poses;
      return { ...d, poses };
    }
    case 'parquet/pose/update': {
      const l = Object.hasOwn(d.poses, a.poseId) ? d.poses[a.poseId]! : null;
      const keys = Object.keys(a.patch) as (keyof ParquetPose)[];
      if (!l || keys.every((k) => Object.is(l[k], a.patch[k]))) return d;
      return { ...d, poses: { ...d.poses, [a.poseId]: { ...l, ...a.patch } } };
    }
    case 'parquet/settings': {
      const keys = Object.keys(a.patch) as (keyof ParquetSettings)[];
      if (keys.every((k) => Object.is(d.settings[k], a.patch[k]))) return d;
      return { ...d, settings: { ...d.settings, ...a.patch } };
    }
    case 'parquet/accessories': {
      const keys = Object.keys(a.patch) as (keyof Accessories)[];
      if (keys.every((k) => Object.is(d.accessories[k], a.patch[k]))) return d;
      return { ...d, accessories: { ...d.accessories, ...a.patch } };
    }
    case 'parquet/worksite/mark': {
      const w = d.worksite?.resultHash === a.hash ? d.worksite : { resultHash: a.hash, done: [] };
      const set = new Set(w.done);
      for (const id of a.ids) {
        if (a.done) set.add(id);
        else set.delete(id);
      }
      const done = [...set];
      if (w === d.worksite && done.length === w.done.length && done.every((id) => w.done.includes(id))) return d;
      return { ...d, worksite: { resultHash: a.hash, done } };
    }
    case 'parquet/worksite/rebase': {
      const keep = new Set(a.valid);
      return { ...d, worksite: { resultHash: a.hash, done: (d.worksite?.done ?? []).filter((id) => keep.has(id)) } };
    }
    case 'parquet/price': {
      const rest = Object.fromEntries(Object.entries(d.prices).filter(([k]) => k !== a.key));
      return { ...d, prices: a.value != null && a.value > 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    default:
      return d;
  }
}
