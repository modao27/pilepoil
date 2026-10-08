/**
 * Point d'entrée du module carrelage (face application) : seul fichier du module importable hors du
 * module, hors tests et hors engine.ts (face moteur, importée par modules/engines.ts).
 */
import type { ToolModule } from '../types';
import type { ProjectResult, ProjectSpec } from './core';
import { reduce, type Action } from './state/actions';
import { CARRELAGE_ID, CARRELAGE_SCHEMA, type CarrelageData } from './state/data';
import { TILE_SCHEMA } from '../../state/model';
import { create, priceAction, shopping, summary, toSpec } from './state/module';

export * from './core';
export * from './state/actions';
export * from './state/data';
export * from './state/factories';
export * from './state/pricing';
export * from './state/selectors';
export * from './state/templates';

/**
 * Écrans et composants utilisés par la coquille, chargés à la demande : importer ce fichier ne charge
 * pas l'interface (le worker et le stockage l'importent). S1 seulement ; remplacé par le registre.
 */
export const ui = {
  /** État du module (bibliothèque, calculs, scénarios). */
  state: () => import('./ui/state.svelte'),
  ProjectCard: () => import('./ui/components/ProjectCard.svelte'),
  Wizard: () => import('./ui/screens/Wizard.svelte'),
  PatternPicker: () => import('./ui/components/PatternPicker.svelte'),
};

/** Même chargeur pour les deux adresses de l'éditeur : il n'est pas recréé quand seule la surface change. */
const editor = () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default);

/** Module carrelage (docs/BOITE.md §2) : tout le contrat sauf achats et bibliothèque (S3). */
export const module: ToolModule<CarrelageData, ProjectSpec, ProjectResult, Action> = {
  id: CARRELAGE_ID,
  label: 'Carrelage',
  description: 'Murs et sols carrelés : calepinage, coupes, chutes, quantités.',
  schemaVersion: CARRELAGE_SCHEMA,
  create,
  reduce: (data, action) => reduce(data, action),
  toSpec,
  summary,
  shopping,
  priceAction,
  migrations: {},
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
      { path: 'room', load: () => import('./ui/screens/Room.svelte').then((m) => m.default) },
      { path: 'compare', load: () => import('./ui/screens/Compare.svelte').then((m) => m.default) },
    ],
  },
};
