/**
 * Actions de la maçonnerie, préfixées par leur identifiant (docs/BOITE.md §5). Un mur est désigné par une cible :
 * une cloison maçonnée du plan ou un mur saisi. Réducteur pur : renvoie les données d'origine si l'action est sans
 * effet ou ne les concerne pas.
 */
import type { PoseEvent } from '../../types';
import {
  defaultBuild,
  type MaconnerieData,
  type MaconnerieSettings,
  type MasonryWall,
  type WallBuild,
  type WallZone,
} from './model';

/** Mur visé : cloison du plan ou mur saisi. */
export type Target = { partition: string } | { wall: string };

type BuildPatch = Partial<Pick<WallBuild, 'material' | 'joint'>>;

export type Action =
  | { type: 'maconnerie/wall/add'; wall: MasonryWall }
  | { type: 'maconnerie/wall/update'; id: string; patch: Partial<Omit<MasonryWall, 'id' | 'zones'>> }
  | { type: 'maconnerie/wall/remove'; id: string }
  | { type: 'maconnerie/build/update'; target: Target; patch: BuildPatch }
  | { type: 'maconnerie/zone/add'; target: Target; zone: WallZone }
  | { type: 'maconnerie/zone/update'; target: Target; id: string; patch: Partial<Omit<WallZone, 'id'>> }
  | { type: 'maconnerie/zone/remove'; target: Target; id: string }
  | { type: 'maconnerie/settings/update'; patch: Partial<MaconnerieSettings> }
  | { type: 'maconnerie/price'; key: string; value: number | null };

const same = <T extends object>(x: T, patch: Partial<T>) =>
  (Object.keys(patch) as (keyof T)[]).every((k) => Object.is(x[k], patch[k]));

/** Applique `f` au réglage du mur visé ; renvoie `d` si rien ne change. */
function onBuild(d: MaconnerieData, target: Target, f: (b: WallBuild) => WallBuild): MaconnerieData {
  if ('wall' in target) {
    const w = d.walls.find((x) => x.id === target.wall);
    if (!w) return d;
    const next = f(w);
    return next === w ? d : { ...d, walls: d.walls.map((x) => (x === w ? { ...w, ...next } : x)) };
  }
  const cur = Object.hasOwn(d.partitions, target.partition) ? d.partitions[target.partition]! : defaultBuild();
  const next = f(cur);
  return next === cur ? d : { ...d, partitions: { ...d.partitions, [target.partition]: next } };
}

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
    case 'maconnerie/build/update':
      return onBuild(d, a.target, (b) => (same(b, a.patch) ? b : { ...b, ...a.patch }));
    case 'maconnerie/zone/add':
      return onBuild(d, a.target, (b) =>
        b.zones.some((z) => z.id === a.zone.id) ? b : { ...b, zones: [...b.zones, a.zone] },
      );
    case 'maconnerie/zone/update':
      return onBuild(d, a.target, (b) => {
        const z = b.zones.find((x) => x.id === a.id);
        return !z || same(z, a.patch) ? b : { ...b, zones: b.zones.map((x) => (x === z ? { ...z, ...a.patch } : x)) };
      });
    case 'maconnerie/zone/remove':
      return onBuild(d, a.target, (b) =>
        b.zones.some((z) => z.id === a.id) ? { ...b, zones: b.zones.filter((z) => z.id !== a.id) } : b,
      );
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
