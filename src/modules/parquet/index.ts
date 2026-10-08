/**
 * Point d'entrée du module parquet (face application). En S3, seule sa bibliothèque de lames existe ;
 * l'outil (pose, moteur) arrive en P1 (docs/PLAN.md).
 */
import type { LibraryDefinition } from '../types';
import { BOARD_SCHEMA, BOARD_TEMPLATES } from './core/board';

export type { Board, BoardKind } from './core/board';

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
