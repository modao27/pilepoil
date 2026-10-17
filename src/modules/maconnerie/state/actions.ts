/**
 * Actions de la maçonnerie, préfixées par leur identifiant (docs/BOITE.md §5). Réducteur pur : renvoie les données
 * d'origine si l'action est sans effet ou ne les concerne pas.
 */
import type { PoseEvent } from '../../types';
import type { MaconnerieData, MaconnerieSettings, MasonryWall } from './model';

export type Action =
  | { type: 'maconnerie/wall/add'; wall: MasonryWall }
  | { type: 'maconnerie/wall/update'; id: string; patch: Partial<Omit<MasonryWall, 'id'>> }
  | { type: 'maconnerie/wall/remove'; id: string }
  | { type: 'maconnerie/settings/update'; patch: Partial<MaconnerieSettings> }
  | { type: 'maconnerie/price'; key: string; value: number | null };

const same = <T extends object>(x: T, patch: Partial<T>) =>
  (Object.keys(patch) as (keyof T)[]).every((k) => Object.is(x[k], patch[k]));

export function reduce(d: MaconnerieData, a: Action | PoseEvent): MaconnerieData {
  switch (a.type) {
    case 'maconnerie/wall/add':
      return d.walls.some((w) => w.id === a.wall.id) ? d : { ...d, walls: [...d.walls, a.wall] };
    case 'maconnerie/wall/update': {
      const cur = d.walls.find((w) => w.id === a.id);
      if (!cur || same(cur, a.patch)) return d;
      return { ...d, walls: d.walls.map((w) => (w.id === a.id ? { ...w, ...a.patch } : w)) };
    }
    case 'maconnerie/wall/remove':
      return d.walls.some((w) => w.id === a.id) ? { ...d, walls: d.walls.filter((w) => w.id !== a.id) } : d;
    case 'maconnerie/settings/update':
      return same(d.settings, a.patch) ? d : { ...d, settings: { ...d.settings, ...a.patch } };
    case 'maconnerie/price': {
      const rest = Object.fromEntries(Object.entries(d.prices).filter(([k]) => k !== a.key));
      return { ...d, prices: a.value != null && a.value >= 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    default:
      return d;
  }
}
