/**
 * Point d'entrée du module parquet (face application) : le `ToolModule`, vu par la coquille via le registre.
 * La face moteur est engine.ts (importée par modules/engines.ts).
 */
import type { LibraryDefinition, ModuleManifest } from '../types';
import { BOARD_SCHEMA, BOARD_TEMPLATES } from './core/board';
import type { ParquetResult, ParquetSpec } from './core/types';
import type { Action } from './state/actions';
import { PARQUET_ID, PARQUET_SCHEMA, type ParquetData } from './state/model';
import { PARQUET_RULES } from './state/ids';

/** Bibliothèque de lames (#/library/boards). */
export const library: LibraryDefinition = {
  id: 'boards',
  label: 'Lames',
  store: 'boards',
  schemaVersion: BOARD_SCHEMA,
  migrations: {},
  screens: {
    list: () => import('./ui/screens/BoardLibrary.svelte').then((m) => m.default),
    edit: () => import('./ui/screens/BoardEdit.svelte').then((m) => m.default),
  },
  templates: () => BOARD_TEMPLATES.map((b) => ({ ...b })),
};

/** Module parquet (docs/BOITE.md §2, docs/parquet/SPEC.md). */
export const module: ModuleManifest<ParquetData, ParquetSpec, ParquetResult, Action> = {
  id: PARQUET_ID,
  label: 'Parquet',
  description: 'Parquet, stratifié, vinyle clipsable : pose, coupes, chutes, paquets.',
  // identité : icones/modules/parquet-34x24.svg (lames en pose décalée)
  icon: '<rect x="2" y="2" width="30" height="20" rx="1.5"/><path d="M2 7h30M2 12h30M2 17h30M13 2v5M25 7v5M8 12v5M20 12v5M28 17v5M15 17v5"/><path fill="currentColor" fill-opacity=".18" stroke="none" d="M13 2h17.5a1.5 1.5 0 0 1 1.5 1.5V7H13z"/>',
  schemaVersion: PARQUET_SCHEMA,
  coverage: PARQUET_RULES,
  poseHref: (p, pose) => `#/p/${encodeURIComponent(p)}/m/parquet/pose/${encodeURIComponent(pose)}`,
  logic: () => import('./logic').then((m) => m.logic),
  results: () => import('./ui/lib/resultsModule').then((m) => m.results),
  migrations: {},
  screens: {
    editor: () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default),
    // éditeur ouvert sur une pose (#/p/:id/m/parquet/pose/:poseId)
    routes: [{ path: 'pose/:poseId', load: () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default) }],
  },
  library,
};
