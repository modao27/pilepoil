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
import { TILE_TEMPLATES } from './state/templates';
import { TILE_CATALOG } from './state/catalog';
import { usesTile } from './state/usage';

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
    usedIn: usesTile,
    templates: () => [...TILE_TEMPLATES, ...TILE_CATALOG].map((t) => ({ ...t })),
    screens: {
      list: () => import('./ui/screens/Library.svelte').then((m) => m.default),
      edit: () => import('./ui/screens/TileEdit.svelte').then((m) => m.default),
    },
  },
  // identité : icones/modules/carrelage-34x24.svg
  icon: '<rect x="2" y="2" width="30" height="20" rx="1.5"/><path d="M12 2v20M22 2v20M2 12h30"/><path fill="currentColor" fill-opacity=".18" stroke="none" d="M12 2h10v10H12z"/>',
  screens: {
    editor: () => import('./ui/screens/ToProject.svelte').then((m) => m.default),
    routes: [
      { path: 's/:surfaceId', load: editor },
      { path: 'compare', load: () => import('./ui/screens/Compare.svelte').then((m) => m.default) },
    ],
    card: () => import('./ui/components/ProjectCard.svelte').then((m) => m.default),
  },
};
