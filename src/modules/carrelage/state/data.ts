/**
 * Données du carrelage dans un projet v2 (`project.modules.carrelage`), rangées par élément du plan, et vue
 * utilisée par le code du module : champs communs du projet, plan, données et surfaces résolues.
 */
import type { Plan } from '../../../core/plan/types';
import type { Id, Project } from '../../../state/model';
import type { ProjectSettings, RoomTiling, Surface } from './model';
import { resolveSurfaces } from './surfaces';

export const CARRELAGE_ID = 'carrelage';
export const CARRELAGE_SCHEMA = 2;

export interface CarrelageData {
  /** Clé = identifiant de pièce du plan. Pièce absente : rien de carrelé dans cette pièce. */
  rooms: Record<Id, RoomTiling>;
  settings: ProjectSettings;
  /** Prix unitaires par clé d'article de la liste d'achat. */
  prices: Record<string, number>;
}

/** Vue du projet pour le code carrelage. Les surfaces sont calculées depuis le plan, jamais enregistrées. */
export interface CarrelageProject extends CarrelageData {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
  /** Surfaces carrelées, dans l'ordre de calcul (pièces du plan ; sol puis murs). */
  surfaces: Surface[];
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  margin: 10,
  reuseOffcuts: true,
  kerf: 2,
  minOffcut: 20,
  shadeVariation: 0.06,
  optimizerGoal: 'thin',
};

export function carrelageData(p: Project): CarrelageData | null {
  const doc = p.modules[CARRELAGE_ID];
  return doc ? (doc.data as CarrelageData) : null;
}

/** Vue carrelage d'un projet ; null si le carrelage n'est pas activé sur ce projet. */
export function carrelageView(p: Project): CarrelageProject | null {
  const d = carrelageData(p);
  return (
    d && {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      plan: p.plan,
      ...dataOf(d),
      surfaces: resolveSurfaces(p.plan, d.rooms),
    }
  );
}

/** Données d'une vue, sans les champs communs ni les surfaces résolues. */
export function dataOf(v: CarrelageData): CarrelageData {
  return { rooms: v.rooms, settings: v.settings, prices: v.prices };
}

/** Projet avec ces données carrelage ; renvoie `p` si elles n'ont pas changé. */
export function withCarrelage(p: Project, data: CarrelageData): Project {
  if (carrelageData(p) === data) return p;
  return { ...p, modules: { ...p.modules, [CARRELAGE_ID]: { schemaVersion: CARRELAGE_SCHEMA, data } } };
}

/** Migrations des données : la version 2 range le carrelage par élément du plan, sans conversion (PLAN C2). */
export const CARRELAGE_MIGRATIONS: Record<number, (doc: unknown) => unknown> = {
  2: (doc) => {
    const d = doc as { settings?: ProjectSettings; prices?: Record<string, number> };
    return { rooms: {}, settings: { ...DEFAULT_SETTINGS, ...d.settings }, prices: d.prices ?? {} };
  },
};
