/** Modèle persisté (voir docs/MODEL.md). Unités : mm, dates en ms. */
import type { Pose, Zone } from '../core/coverage/types';
import type { Plan } from '../core/plan/types';

export type Id = string;

export const PROJECT_SCHEMA = 3;

/**
 * Projet v3 : plan commun, zones et poses (quelles parties de quelles surfaces reçoivent quel revêtement,
 * docs/NAVIGATION.md §4), réglages de chaque module activé.
 */
export interface Project {
  schemaVersion: typeof PROJECT_SCHEMA;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
  /** Parties de surfaces revêtues ; deux zones d'une même surface ne se recouvrent pas. */
  zones: Zone[];
  /** Revêtements continus ; chaque zone appartient à une pose. */
  poses: Pose[];
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
  | { key: 'librarySeeded'; value: string[] };

export type PrefKey = Pref['key'];
export type PrefValue<K extends PrefKey> = Extract<Pref, { key: K }>['value'];
