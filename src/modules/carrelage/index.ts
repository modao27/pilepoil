/**
 * Point d'entrée du module carrelage (face application) : le `ToolModule`, seul objet vu par la coquille via
 * le registre. La face moteur est engine.ts (importée par modules/engines.ts).
 */
import type { ToolModule } from '../types';
import type { ProjectResult, ProjectSpec } from './core';
import { reduce, type Action } from './state/actions';
import { CARRELAGE_ID, CARRELAGE_MIGRATIONS, CARRELAGE_SCHEMA, type CarrelageData } from './state/data';
import { TILE_SCHEMA } from './state/model';
import { create, priceAction, shopping, summary, toSpec } from './state/module';

/** Même chargeur pour les deux adresses de l'éditeur : il n'est pas recréé quand seule la surface change. */
const editor = () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default);

/** État du module (bibliothèque, calculs, scénarios), chargé à la demande avec l'interface. */
const state = () => import('./ui/state.svelte').then((m) => m.carrelage);

/** Module carrelage (docs/BOITE.md §2). */
export const module: ToolModule<CarrelageData, ProjectSpec, ProjectResult, Action> = {
  id: CARRELAGE_ID,
  label: 'Carrelage',
  description: 'Murs et sols carrelés : calepinage, coupes, chutes, quantités.',
  schemaVersion: CARRELAGE_SCHEMA,
  create,
  reduce: (data, action, plan) => reduce(data, action, plan),
  toSpec,
  summary,
  shopping,
  priceAction,
  migrations: CARRELAGE_MIGRATIONS,
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
    editor,
    results: () => import('./ui/screens/Results.svelte').then((m) => m.default),
    routes: [
      { path: 's/:surfaceId', load: editor },
      { path: 'compare', load: () => import('./ui/screens/Compare.svelte').then((m) => m.default) },
    ],
    create: () => import('./ui/screens/Wizard.svelte').then((m) => m.default),
    card: () => import('./ui/components/ProjectCard.svelte').then((m) => m.default),
    settings: () => import('./ui/components/LegacyImport.svelte').then((m) => m.default),
  },
};
