/**
 * Point d'entrée du module maçonnerie (face application) : le `ToolModule`, vu par la coquille via le registre.
 * La face moteur est engine.ts (importée par modules/engines.ts).
 */
import type { LibraryDefinition, ModuleManifest } from '../types';
import type { MaconnerieResult, MaconnerieSpec } from './core/types';
import { MATERIAL_SCHEMA, templateMaterials } from './core/defaults';
import type { Action } from './state/actions';
import { MACONNERIE_ID, MACONNERIE_SCHEMA, type MaconnerieData } from './state/model';
import { usesMaterial } from './state/usage';

/** Bibliothèque de matériaux de maçonnerie (#/library/materials). */
export const library: LibraryDefinition = {
  id: 'materials',
  label: 'Maçonnerie',
  store: 'materials',
  schemaVersion: MATERIAL_SCHEMA,
  migrations: {},
  screens: {
    list: () => import('./ui/screens/MaterialLibrary.svelte').then((m) => m.default),
    edit: () => import('./ui/screens/MaterialEdit.svelte').then((m) => m.default),
  },
  templates: () => templateMaterials(),
  usedIn: usesMaterial,
};

/** Module maçonnerie (docs/materiaux/SPEC.md) : pas de pose ; les murets multi-matériaux viennent ensuite. */
export const module: ModuleManifest<MaconnerieData, MaconnerieSpec, MaconnerieResult, Action> = {
  id: MACONNERIE_ID,
  label: 'Maçonnerie',
  description: 'Murs en parpaings, briques, béton cellulaire, carreaux de plâtre et briques de verre.',
  // mur appareillé en quinconce
  icon: '<rect x="2" y="2" width="30" height="20" rx="1.5"/><path d="M2 8h30M2 15h30M12 2v6M22 8v7M8 15v7M20 15v7"/>',
  schemaVersion: MACONNERIE_SCHEMA,
  logic: () => import('./logic').then((m) => m.logic),
  results: () => import('./ui/lib/resultsModule').then((m) => m.results),
  migrations: {},
  screens: {
    editor: () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default),
  },
  library,
};
