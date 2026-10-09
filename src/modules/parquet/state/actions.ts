/**
 * Actions du parquet, préfixées par son identifiant (docs/BOITE.md §5). Réducteur pur : renvoie les données
 * d'origine si l'action est sans effet ou ne le concerne pas.
 */
import type { ParquetSettings } from '../core/types';
import type { Layout, ParquetData } from './model';

type Id = string;

export type Action =
  | { type: 'parquet/layout/add'; layout: Layout }
  | { type: 'parquet/layout/update'; layoutId: Id; patch: Partial<Omit<Layout, 'id'>> }
  | { type: 'parquet/layout/remove'; layoutId: Id }
  | { type: 'parquet/settings'; patch: Partial<ParquetSettings> }
  | { type: 'parquet/price'; key: string; value: number | null };

/** Prévenu par le plan : une pièce a disparu (docs/BOITE.md §5). */
interface RoomRemoved {
  type: 'plan/room/removed';
  roomId: Id;
}

export function reduce(d: ParquetData, a: Action | RoomRemoved): ParquetData {
  switch (a.type) {
    case 'parquet/layout/add':
      return { ...d, layouts: [...d.layouts, a.layout] };
    case 'parquet/layout/update': {
      let changed = false;
      const layouts = d.layouts.map((l) => {
        if (l.id !== a.layoutId) return l;
        const keys = Object.keys(a.patch) as (keyof typeof a.patch)[];
        if (keys.every((k) => Object.is(l[k], a.patch[k]))) return l;
        changed = true;
        return { ...l, ...a.patch };
      });
      return changed ? { ...d, layouts } : d;
    }
    case 'parquet/layout/remove': {
      const layouts = d.layouts.filter((l) => l.id !== a.layoutId);
      return layouts.length === d.layouts.length ? d : { ...d, layouts };
    }
    case 'parquet/settings': {
      const keys = Object.keys(a.patch) as (keyof ParquetSettings)[];
      if (keys.every((k) => Object.is(d.settings[k], a.patch[k]))) return d;
      return { ...d, settings: { ...d.settings, ...a.patch } };
    }
    case 'parquet/price': {
      const rest = Object.fromEntries(Object.entries(d.prices).filter(([k]) => k !== a.key));
      return { ...d, prices: a.value != null && a.value > 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    case 'plan/room/removed': {
      if (!d.layouts.some((l) => l.rooms.includes(a.roomId))) return d;
      const layouts = d.layouts.map((l) =>
        l.rooms.includes(a.roomId)
          ? {
              ...l,
              rooms: l.rooms.filter((r) => r !== a.roomId),
              reference: l.reference?.room === a.roomId ? null : l.reference,
            }
          : l,
      );
      return { ...d, layouts };
    }
    default:
      return d;
  }
}
