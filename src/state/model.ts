/** Modèle persisté (voir docs/MODEL.md). Unités : mm, dates en ms. */
import type { Plan } from '../core/plan/types';

export type Id = string;

export const PROJECT_SCHEMA = 2;

/**
 * Projet v1 (avant la boîte à outils) : le carrelage seul. La coquille n'en connaît que ce qu'il faut pour la
 * migration v1 → v2 (`storage/migrations.ts`) ; le type complet est celui du module carrelage.
 */
export interface ProjectV1 {
  schemaVersion: 1;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  surfaces: unknown[];
  room: { length: number; width: number; height: number } | null;
  settings: unknown;
  prices: Record<string, number>;
}

/** Projet v2 (docs/BOITE.md §4) : plan commun + données de chaque module activé. */
export interface Project {
  schemaVersion: typeof PROJECT_SCHEMA;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
  /** Données de chaque module activé, avec leur propre version ; clé = identifiant du module. */
  modules: Record<string, ModuleDoc>;
}

/** Chaque module type et valide ses propres `data`. */
export interface ModuleDoc {
  schemaVersion: number;
  data: unknown;
}

export interface Photo {
  id: Id;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export interface Palette {
  tiles: string[];
  grouts: string[];
}

export type Pref =
  | { key: 'palette'; value: Palette }
  | { key: 'theme'; value: 'auto' | 'light' | 'dark' }
  | { key: 'lastProjectId'; value: Id }
  | { key: 'showCutNumbers'; value: boolean }
  /** Bibliothèques dont les modèles types ont été posés (une seule fois). */
  | { key: 'librarySeeded'; value: string[] }
  | { key: 'legacyImport'; value: { at: number; projectId: Id | null } }
  /** Copie unique de l'ancienne base « calepinage » (from null : rien à copier). */
  | { key: 'copiedFrom'; value: { from: string | null; at: number; projects: number } };

export type PrefKey = Pref['key'];
export type PrefValue<K extends PrefKey> = Extract<Pref, { key: K }>['value'];
