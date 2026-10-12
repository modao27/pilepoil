/**
 * Point d'entrée du module carrelage (face application) : le `ToolModule`, seul objet vu par la coquille via
 * le registre. La face moteur est engine.ts (importée par modules/engines.ts).
 */
import type { ModuleManifest } from '../types';
import type { ProjectResult, ProjectSpec } from './core';
import type { Action } from './state/actions';
import type { CarrelageData } from './state/data';
import { CARRELAGE_ID, CARRELAGE_SCHEMA, TILE_RULES } from './state/ids';
import { TILE_SCHEMA } from './state/model';

/** Éditeur d'une surface : #/p/:id/m/carrelage/s/:surfaceId. */
const editor = () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default);

/** État du module (bibliothèque, calculs, scénarios), chargé à la demande avec l'interface. */
const state = () => import('./ui/state.svelte').then((m) => m.carrelage);

/** Module carrelage (docs/BOITE.md §2). */
export const module: ModuleManifest<CarrelageData, ProjectSpec, ProjectResult, Action> = {
  id: CARRELAGE_ID,
  label: 'Carrelage',
  description: 'Murs et sols carrelés : calepinage, coupes, chutes, quantités.',
  schemaVersion: CARRELAGE_SCHEMA,
  coverage: TILE_RULES,
  poseHref: (p, pose) => `#/p/${encodeURIComponent(p)}/m/carrelage/s/${encodeURIComponent(pose)}`,
  logic: () => import('./logic').then((m) => m.logic),
  results: () => import('./ui/lib/resultsModule').then((m) => m.results),
  migrations: {},
  start: async (db) => (await state()).start(db),
  usedPhotos: (db) => import('./storage/scenarios').then((m) => m.scenarioPhotos(db)),
  library: {
    id: 'tiles',
    label: 'Carreaux',
    store: 'tiles',
    schemaVersion: TILE_SCHEMA,
    migrations: {},
    screens: {
      list: () => import('./ui/screens/Library.svelte').then((m) => m.default),
      edit: () => import('./ui/screens/TileEdit.svelte').then((m) => m.default),
    },
  },
  icon: '<rect x="1" y="1" width="32" height="22" rx="1"/><path d="M12 1v22M23 1v22M1 12h32"/>',
  screens: {
    editor: () => import('./ui/screens/ToProject.svelte').then((m) => m.default),
    routes: [
      { path: 's/:surfaceId', load: editor },
      { path: 'compare', load: () => import('./ui/screens/Compare.svelte').then((m) => m.default) },
    ],
    card: () => import('./ui/components/ProjectCard.svelte').then((m) => m.default),
  },
};
