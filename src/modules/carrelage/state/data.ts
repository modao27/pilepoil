/**
 * Données du carrelage dans un projet (`project.modules.carrelage`) : réglages de chaque pose, réglages communs,
 * prix. Les zones et les poses elles-mêmes sont dans le projet (docs/NAVIGATION.md §4). Vue utilisée par le code
 * du module : champs communs, plan, zones et poses de carrelage, données et surfaces résolues.
 */
import type { Pose, Zone } from '../../../core/coverage/types';
import type { Plan } from '../../../core/plan/types';
import type { Id, Project } from '../../../state/model';
import type { CarrelagePose, ProjectSettings, Surface } from './model';
import { resolveSurfaces } from './surfaces';

export const CARRELAGE_ID = 'carrelage';
export const CARRELAGE_SCHEMA = 3;

export interface CarrelageData {
  /** Réglages de chaque pose de carrelage du projet ; clé = identifiant de la pose. */
  poses: Record<Id, CarrelagePose>;
  settings: ProjectSettings;
  /** Prix unitaires par clé d'article de la liste d'achat. */
  prices: Record<string, number>;
}

/** Vue du projet pour le code carrelage. Les surfaces sont calculées depuis le plan et les zones. */
export interface CarrelageProject extends CarrelageData {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
  /** Zones des poses de carrelage. */
  zones: Zone[];
  /** Poses de carrelage, dans l'ordre du projet. */
  tilePoses: Pose[];
  /** Une surface par pose, dans l'ordre des poses (ordre de calcul et de numérotation). */
  surfaces: Surface[];
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  margin: 10,
  reuseOffcuts: true,
  kerf: 2,
  minOffcut: 20,
  shadeVariation: 0.06,
  optimizerGoal: 'thin',
  outerCornersCovered: true,
};

export function carrelageData(p: Project): CarrelageData | null {
  const doc = p.modules[CARRELAGE_ID];
  return doc ? (doc.data as CarrelageData) : null;
}

/** Vue carrelage d'un projet ; null si le carrelage n'est pas activé sur ce projet. */
export function carrelageView(p: Project): CarrelageProject | null {
  const d = carrelageData(p);
  if (!d) return null;
  const tilePoses = p.poses.filter((x) => x.module === CARRELAGE_ID && Object.hasOwn(d.poses, x.id));
  const ids = new Set(tilePoses.map((x) => x.id));
  const zones = p.zones.filter((z) => ids.has(z.pose));
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    plan: p.plan,
    ...dataOf(d),
    zones,
    tilePoses,
    surfaces: resolveSurfaces(p.plan, tilePoses, zones, d.poses),
  };
}

/** Données d'une vue, sans les champs communs ni les surfaces résolues. */
export function dataOf(v: CarrelageData): CarrelageData {
  return { poses: v.poses, settings: v.settings, prices: v.prices };
}

/** Projet avec ces données carrelage ; renvoie `p` si elles n'ont pas changé. */
export function withCarrelage(p: Project, data: CarrelageData): Project {
  if (carrelageData(p) === data) return p;
  return { ...p, modules: { ...p.modules, [CARRELAGE_ID]: { schemaVersion: CARRELAGE_SCHEMA, data } } };
}
