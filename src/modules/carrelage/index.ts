/**
 * Point d'entrée du module carrelage (face application) : seul fichier du module importable hors du
 * module, hors tests et hors engine.ts (face moteur, importée par modules/engines.ts).
 */
import type { ToolModuleS1 } from '../types';

export * from './core';
export * from './state/actions';
export * from './state/factories';
export * from './state/library';
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
  Library: () => import('./ui/screens/Library.svelte'),
  TileEdit: () => import('./ui/screens/TileEdit.svelte'),
  Wizard: () => import('./ui/screens/Wizard.svelte'),
  PatternPicker: () => import('./ui/components/PatternPicker.svelte'),
};

/** Même chargeur pour les deux adresses de l'éditeur : il n'est pas recréé quand seule la surface change. */
const editor = () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default);

/** Module carrelage : en S1, identité et écrans seulement (docs/BOITE.md §2). */
export const module: ToolModuleS1 = {
  id: 'carrelage',
  label: 'Carrelage',
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
