/**
 * Actions des cloisons, préfixées par leur identifiant (docs/BOITE.md §5). Réducteur pur : renvoie les données d'origine
 * si l'action est sans effet ou ne les concerne pas.
 */
import type { PoseEvent } from '../../types';
import type { CloisonsSettings, Id } from '../core/types';
import { defaultPartitionSettings, type CloisonsData, type PartitionSettings } from './model';

export type Action =
  | { type: 'cloisons/partition/update'; partitionId: Id; patch: Partial<PartitionSettings> }
  | { type: 'cloisons/settings/update'; patch: Partial<CloisonsSettings> }
  /** Retire les réglages des cloisons qui n'existent plus dans le plan. */
  | { type: 'cloisons/prune'; keep: Id[] }
  | { type: 'cloisons/price'; key: string; value: number | null };

const same = <T extends object>(x: T, patch: Partial<T>) =>
  (Object.keys(patch) as (keyof T)[]).every((k) => Object.is(x[k], patch[k]));

export function reduce(d: CloisonsData, a: Action | PoseEvent): CloisonsData {
  switch (a.type) {
    case 'cloisons/partition/update': {
      const cur = Object.hasOwn(d.partitions, a.partitionId) ? d.partitions[a.partitionId]! : null;
      if (cur && same(cur, a.patch)) return d;
      return {
        ...d,
        partitions: { ...d.partitions, [a.partitionId]: { ...(cur ?? defaultPartitionSettings()), ...a.patch } },
      };
    }
    case 'cloisons/settings/update':
      return same(d.settings, a.patch) ? d : { ...d, settings: { ...d.settings, ...a.patch } };
    case 'cloisons/prune': {
      const keep = new Set(a.keep);
      const ids = Object.keys(d.partitions);
      if (ids.every((id) => keep.has(id))) return d;
      return { ...d, partitions: Object.fromEntries(Object.entries(d.partitions).filter(([id]) => keep.has(id))) };
    }
    case 'cloisons/price': {
      const rest = Object.fromEntries(Object.entries(d.prices).filter(([k]) => k !== a.key));
      return { ...d, prices: a.value != null && a.value > 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    default:
      return d;
  }
}
