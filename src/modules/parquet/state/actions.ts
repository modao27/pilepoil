/**
 * Actions du parquet, préfixées par son identifiant (docs/BOITE.md §5). Réducteur pur : renvoie les données
 * d'origine si l'action est sans effet ou ne le concerne pas.
 */
import type { Segment } from '../../../core/geometry/types';
import type { Accessories, ParquetSettings } from '../core/types';
import type { Layout, ParquetData } from './model';

type Id = string;

export type Action =
  | { type: 'parquet/layout/add'; layout: Layout }
  | { type: 'parquet/layout/update'; layoutId: Id; patch: Partial<Omit<Layout, 'id'>> }
  | { type: 'parquet/layout/remove'; layoutId: Id }
  /** Sépare une pose en deux le long d'une ligne : elle garde le côté 1, la nouvelle (newId) le côté −1. */
  | { type: 'parquet/layout/split'; layoutId: Id; line: Segment; newId: Id }
  | { type: 'parquet/settings'; patch: Partial<ParquetSettings> }
  | { type: 'parquet/accessories'; patch: Partial<Accessories> }
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
      const gone = d.layouts.find((l) => l.id === a.layoutId);
      if (!gone) return d;
      // les autres poses reprennent la surface laissée : leurs limites communes avec elle disparaissent
      const shared = (b: Layout['zone'][number]) =>
        gone.zone.some((g) => g.side === -b.side && sameSegment(g.line, b.line));
      const layouts = d.layouts
        .filter((l) => l.id !== a.layoutId)
        .map((l) => (l.zone.some(shared) ? { ...l, zone: l.zone.filter((b) => !shared(b)) } : l));
      return { ...d, layouts };
    }
    case 'parquet/layout/split': {
      const l = d.layouts.find((x) => x.id === a.layoutId);
      if (!l || d.layouts.some((x) => x.id === a.newId)) return d;
      // un seuil posé sur cette ligne devient la limite des deux zones
      const breaks = l.breaks.filter((b) => !sameSegment(b, a.line));
      const names = new Set(d.layouts.map((x) => x.name));
      let n = d.layouts.length + 1;
      while (names.has(`Pose ${n}`)) n++;
      const kept = { ...l, breaks, zone: [...l.zone, { line: a.line, side: 1 as const }] };
      const added = {
        ...l,
        id: a.newId,
        name: `Pose ${n}`,
        breaks,
        zone: [...l.zone, { line: a.line, side: -1 as const }],
      };
      const layouts = d.layouts.flatMap((x) => (x.id === l.id ? [kept, added] : [x]));
      return { ...d, layouts };
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

const sameSegment = (a: Segment, b: Segment) =>
  a.every((p, i) => Math.abs(p[0] - b[i]![0]) < 0.5 && Math.abs(p[1] - b[i]![1]) < 0.5);
