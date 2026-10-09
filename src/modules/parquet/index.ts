/**
 * Point d'entrée du module parquet (face application) : le `ToolModule`, vu par la coquille via le registre.
 * La face moteur est engine.ts (importée par modules/engines.ts).
 */
import type { LibraryDefinition, ToolModule } from '../types';
import { BOARD_SCHEMA, BOARD_TEMPLATES } from './core/board';
import type { ParquetResult, ParquetSpec } from './core/types';
import { reduce, type Action } from './state/actions';
import { PARQUET_ID, PARQUET_SCHEMA, type ParquetData } from './state/model';
import { create, createPose, priceAction, shopping, summary, toSpec } from './state/module';
import { PARQUET_RULES } from './state/poses';

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
export const module: ToolModule<ParquetData, ParquetSpec, ParquetResult, Action> = {
  id: PARQUET_ID,
  label: 'Parquet',
  description: 'Parquet, stratifié, vinyle clipsable : pose, coupes, chutes, paquets.',
  // lames en pose décalée, trait fin (34 × 24)
  icon: '<rect x="1" y="1" width="32" height="22" rx="1"/><path d="M1 8.3h32M1 15.7h32M12 1v7.3M26 1v7.3M6 8.3v7.4M20 8.3v7.4M15 15.7V23M29 15.7V23"/>',
  schemaVersion: PARQUET_SCHEMA,
  create,
  coverage: PARQUET_RULES,
  createPose,
  reduce: (data, action) => reduce(data, action),
  toSpec,
  shopping,
  summary,
  priceAction,
  migrations: {},
  screens: {
    editor: () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default),
    results: () => import('./ui/screens/ResultsScreen.svelte').then((m) => m.default),
    worksite: () => import('./ui/screens/WorksiteScreen.svelte').then((m) => m.default),
  },
  library,
};
