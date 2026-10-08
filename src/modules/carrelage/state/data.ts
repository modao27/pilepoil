/**
 * Données du carrelage dans un projet v2 (`project.modules.carrelage`) et vue utilisée par le code du
 * module : champs communs du projet + données carrelage, soit la forme de l'ancien projet v1.
 */
import type { Id, Project } from '../../../state/model';
import type { ProjectSettings, Room, Surface } from './model';

export const CARRELAGE_ID = 'carrelage';
export const CARRELAGE_SCHEMA = 1;

/** Données carrelage = l'ancien projet v1 sans les champs communs (docs/BOITE.md §4). */
export interface CarrelageData {
  /** Ordre = ordre d'affichage et de calcul (réemploi, numérotation des carreaux). */
  surfaces: Surface[];
  room: Room | null;
  settings: ProjectSettings;
  /** Prix unitaires par clé d'article de la liste d'achat. */
  prices: Record<string, number>;
}

/** Vue du projet pour le code carrelage. */
export interface CarrelageProject extends CarrelageData {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
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
  return d && { id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, ...d };
}

/** Données d'une vue (ou d'un projet v1), sans les champs communs. */
export function dataOf(v: CarrelageData): CarrelageData {
  return { surfaces: v.surfaces, room: v.room, settings: v.settings, prices: v.prices };
}

/** Projet avec ces données carrelage ; renvoie `p` si elles n'ont pas changé. */
export function withCarrelage(p: Project, data: CarrelageData): Project {
  if (carrelageData(p) === data) return p;
  return { ...p, modules: { ...p.modules, [CARRELAGE_ID]: { schemaVersion: CARRELAGE_SCHEMA, data } } };
}
