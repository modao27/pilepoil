/**
 * Point d'entrée du module cloisons (face application) : le `ToolModule`, vu par la coquille via le registre.
 * La face moteur est engine.ts (importée par modules/engines.ts).
 */
import type { LibraryDefinition, ModuleManifest } from '../types';
import { templateSystems } from './core/defaults';
import type { CloisonsResult, CloisonsSpec } from './core/types';
import type { Action } from './state/actions';
import { CLOISONS_ID, CLOISONS_SCHEMA, type CloisonsData } from './state/model';
import { usesSystem } from './state/usage';

/** Bibliothèque de systèmes de cloison (#/library/systems). */
export const library: LibraryDefinition = {
  id: 'systems',
  label: 'Cloisons',
  store: 'systems',
  schemaVersion: 1,
  migrations: {},
  screens: {
    list: () => import('./ui/screens/SystemLibrary.svelte').then((m) => m.default),
    edit: () => import('./ui/screens/SystemEdit.svelte').then((m) => m.default),
  },
  templates: () => templateSystems(),
  usedIn: usesSystem,
};

/** Module cloisons (docs/BOITE.md §2, docs/cloisons/SPEC.md) : pas de pose, ses objets sont les cloisons du plan. */
export const module: ModuleManifest<CloisonsData, CloisonsSpec, CloisonsResult, Action> = {
  id: CLOISONS_ID,
  label: 'Cloisons',
  description: 'Cloisons en plaques de plâtre : rails, montants, plaques, isolant.',
  // cloison vue de face : rails et montants
  icon: '<rect x="2" y="2" width="30" height="20" rx="1.5"/><path d="M2 6h30M2 18h30M10 6v12M17 6v12M24 6v12"/>',
  schemaVersion: CLOISONS_SCHEMA,
  logic: () => import('./logic').then((m) => m.logic),
  results: () => import('./ui/lib/resultsModule').then((m) => m.results),
  migrations: {},
  screens: {
    editor: () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default),
    routes: [
      { path: 'c/:partitionId', load: () => import('./ui/screens/ElevationScreen.svelte').then((m) => m.default) },
    ],
  },
  library,
};
