/** Modèle persisté (voir docs/MODEL.md). Unités : mm, dates en ms. */
import type { Pose, Zone } from '../core/coverage/types';
import { planAfter } from '../core/plan/derive';
import type { Plan, Site } from '../core/plan/types';

export type Id = string;

export const PROJECT_SCHEMA = 4;

/**
 * Projet v4 : plan v3 (état existant, cloisons, démolitions : docs/BOITE.md §3 bis), zones et poses (quelles parties de
 * quelles surfaces reçoivent quel revêtement, docs/NAVIGATION.md §4), réglages de chaque module activé.
 */
export interface Project {
  schemaVersion: typeof PROJECT_SCHEMA;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Enregistré : l'état existant et les travaux. Lu seulement par l'éditeur de plan, le réducteur et les cloisons. */
  site: Site;
  /** Plan APRÈS travaux, `planAfter(site)` : calculé à chaque changement et au chargement, jamais enregistré. */
  plan: Plan;
  /** Parties de surfaces revêtues ; deux zones d'une même surface ne se recouvrent pas. */
  zones: Zone[];
  /** Revêtements continus ; chaque zone appartient à une pose. */
  poses: Pose[];
  /** Données de chaque module activé, avec leur propre version ; clé = identifiant du module. */
  modules: Record<string, ModuleDoc>;
}

/** Le projet tel qu'il est enregistré : sans le plan calculé. */
export type StoredProject = Omit<Project, 'plan'>;

/** Plan v3 sans travaux : l'état existant seul. */
export const siteOf = (plan: Plan): Site => ({ existing: plan, partitions: [], demolitions: [] });

/** Projet en mémoire à partir du projet enregistré. */
export function hydrate(p: StoredProject): Project {
  return { ...p, plan: planAfter(p.site) };
}

/** Copie figée d'un projet d'avant le plan v3 (scénarios A/B) : elle n'a pas de `site`, son plan en tient lieu. */
export function withSite(p: Project): Project {
  return p.site ? p : { ...p, site: siteOf(p.plan) };
}

/** Projet à enregistrer : sans le plan calculé. */
export function dehydrate(p: Project): StoredProject {
  const { plan: _plan, ...stored } = p;
  void _plan;
  return stored;
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
  /** Bibliothèques dont les modèles types ont été posés, avant B1 (lu seulement, voir state/seeding.ts). */
  | { key: 'librarySeeded'; value: string[] }
  /** Modèles types posés, `<bibliothèque>:<modèle>` : chacun une seule fois. */
  | { key: 'templatesSeeded'; value: string[] }
  | { key: 'wallThickness'; value: number }
  /** La présentation du premier lancement a été vue (ou passée). */
  | { key: 'welcomeSeen'; value: boolean };

export type PrefKey = Pref['key'];
export type PrefValue<K extends PrefKey> = Extract<Pref, { key: K }>['value'];
