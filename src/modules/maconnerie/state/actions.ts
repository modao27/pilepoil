/** Actions de la maçonnerie, préfixées par leur identifiant (docs/BOITE.md §5). */
import type { PoseEvent } from '../../types';
import type { MaconnerieData } from './model';

export type Action = { type: 'maconnerie/price'; key: string; value: number | null };

export function reduce(d: MaconnerieData, a: Action | PoseEvent): MaconnerieData {
  if (a.type !== 'maconnerie/price') return d;
  const rest = Object.fromEntries(Object.entries(d.prices).filter(([k]) => k !== a.key));
  return { ...d, prices: a.value != null && a.value >= 0 ? { ...rest, [a.key]: a.value } : rest };
}
