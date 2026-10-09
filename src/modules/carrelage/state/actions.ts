import type { Id } from '../../../state/model';
import type { PoseEvent } from '../../types';
import type { Band, CarrelagePose, OpeningFinish, ProjectSettings, Reservation } from './model';
import { dataOf, type CarrelageData } from './data';
import { DEFAULT_FINISH } from './surfaces';

/** Réglages modifiables d'une pose (bandes, réservations, ouvertures : actions dédiées). */
export type PosePatch = Partial<Omit<CarrelagePose, 'bands' | 'reservations' | 'openings'>>;

/**
 * Actions du carrelage, préfixées par son identifiant (docs/BOITE.md §5). Toutes passent par `reduce`, qui ne
 * modifie jamais son entrée. Une pose est désignée par son identifiant (`poseId`) ; ses zones se modifient par
 * les actions du projet (`zone/*`, `pose/*`). Renommer le projet et grouper des actions (`batch`) sont des
 * actions du projet.
 */
export type Action =
  | { type: 'carrelage/settings'; patch: Partial<ProjectSettings> }
  | { type: 'carrelage/price'; key: string; value: number | null }
  | { type: 'carrelage/pose/update'; poseId: Id; patch: PosePatch }
  | { type: 'carrelage/band/add'; poseId: Id; band: Band; index?: number }
  | { type: 'carrelage/band/remove'; poseId: Id; bandId: Id }
  | { type: 'carrelage/band/update'; poseId: Id; bandId: Id; patch: Partial<Omit<Band, 'id'>> }
  | { type: 'carrelage/band/move'; poseId: Id; bandId: Id; to: number }
  /** Toutes les bandes d'une pose (modèle de bandes). */
  | { type: 'carrelage/band/replaceAll'; poseId: Id; bands: Band[]; split?: CarrelagePose['split'] }
  | { type: 'carrelage/reservation/add'; poseId: Id; reservation: Reservation }
  | { type: 'carrelage/reservation/remove'; poseId: Id; reservationId: Id }
  | {
      type: 'carrelage/reservation/update';
      poseId: Id;
      reservationId: Id;
      patch: Partial<Omit<Reservation, 'id' | 'surface'>>;
    }
  /** Finition d'une porte ou fenêtre du plan dans une pose de mur. */
  | { type: 'carrelage/opening/finish'; poseId: Id; openingId: Id; patch: Partial<OpeningFinish> }
  /** Toutes les données (scénario). */
  | { type: 'carrelage/replace'; data: CarrelageData };

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  const [it] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, it!);
  return out;
}

function updateById<T extends { id: Id }>(list: readonly T[], id: Id, f: (x: T) => T): T[] {
  let changed = false;
  const out = list.map((x) => {
    if (x.id !== id) return x;
    const y = f(x);
    if (y !== x) changed = true;
    return y;
  });
  return changed ? out : (list as T[]);
}

/** Applique un patch ; renvoie l'objet d'origine si rien ne change (pas d'étape d'historique inutile). */
function patch<T extends object>(x: T, p: Partial<NoInfer<T>>): T {
  const keys = Object.keys(p) as (keyof T)[];
  if (keys.every((k) => Object.is(x[k], p[k]))) return x;
  return { ...x, ...p };
}

const without = <T>(r: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(r).filter(([k]) => k !== key));

function poseReduce(t: CarrelagePose, a: Action): CarrelagePose {
  switch (a.type) {
    case 'carrelage/pose/update':
      return patch(t, a.patch);
    case 'carrelage/band/add': {
      const bands = t.bands.slice();
      bands.splice(a.index ?? bands.length, 0, a.band);
      return { ...t, bands };
    }
    case 'carrelage/band/remove': {
      if (t.bands.length <= 1 || !t.bands.some((z) => z.id === a.bandId)) return t;
      const bands = t.bands.filter((z) => z.id !== a.bandId);
      const plinth = t.plinth?.bandId === a.bandId ? { ...t.plinth, bandId: bands[0]!.id } : t.plinth;
      return { ...t, bands, plinth };
    }
    case 'carrelage/band/update': {
      const bands = updateById(t.bands, a.bandId, (z) => patch(z, a.patch));
      return bands === t.bands ? t : { ...t, bands };
    }
    case 'carrelage/band/replaceAll': {
      if (!a.bands.length) return t;
      const ids = new Set(a.bands.map((z) => z.id));
      const plinth = t.plinth && !ids.has(t.plinth.bandId) ? { ...t.plinth, bandId: a.bands[0]!.id } : t.plinth;
      return { ...t, bands: a.bands, split: a.split ?? t.split, plinth };
    }
    case 'carrelage/band/move': {
      const from = t.bands.findIndex((z) => z.id === a.bandId);
      return from < 0 || from === a.to ? t : { ...t, bands: move(t.bands, from, a.to) };
    }
    case 'carrelage/reservation/add':
      return { ...t, reservations: [...t.reservations, a.reservation] };
    case 'carrelage/reservation/remove': {
      const reservations = t.reservations.filter((r) => r.id !== a.reservationId);
      return reservations.length === t.reservations.length ? t : { ...t, reservations };
    }
    case 'carrelage/reservation/update': {
      const reservations = updateById(t.reservations, a.reservationId, (r) => patch(r, a.patch));
      return reservations === t.reservations ? t : { ...t, reservations };
    }
    case 'carrelage/opening/finish': {
      const old = Object.hasOwn(t.openings, a.openingId) ? t.openings[a.openingId] : undefined;
      const next = patch(old ?? DEFAULT_FINISH, a.patch);
      return next === old ? t : { ...t, openings: { ...t.openings, [a.openingId]: next } };
    }
    default:
      return t;
  }
}

/**
 * Réducteur pur des données carrelage (ou d'une vue `CarrelageProject`, champs communs conservés), et des
 * événements de pose envoyés par le projet. Renvoie `d` inchangé (même référence) si l'action est sans effet.
 */
export function reduce<P extends CarrelageData>(d: P, a: Action | PoseEvent): P {
  switch (a.type) {
    case 'pose/added':
      return Object.hasOwn(d.poses, a.poseId)
        ? d
        : { ...d, poses: { ...d.poses, [a.poseId]: a.settings as CarrelagePose } };
    case 'pose/removed':
      return Object.hasOwn(d.poses, a.poseId) ? { ...d, poses: without(d.poses, a.poseId) } : d;
    case 'carrelage/settings': {
      const settings = patch(d.settings, a.patch);
      return settings === d.settings ? d : { ...d, settings };
    }
    case 'carrelage/price': {
      const rest = without(d.prices, a.key);
      return { ...d, prices: a.value != null && a.value > 0 ? { ...rest, [a.key]: a.value } : rest };
    }
    case 'carrelage/replace':
      return { ...d, ...dataOf(a.data) };
    default: {
      if (!('poseId' in a) || !Object.hasOwn(d.poses, a.poseId)) return d;
      const old = d.poses[a.poseId]!;
      const next = poseReduce(old, a);
      return next === old ? d : { ...d, poses: { ...d.poses, [a.poseId]: next } };
    }
  }
}
