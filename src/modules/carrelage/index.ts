/** Point d'entrée du module carrelage : seul fichier du module importable hors du module (hors tests). */
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
  Editor: () => import('./ui/editor/Editor.svelte'),
  Compare: () => import('./ui/screens/Compare.svelte'),
  Library: () => import('./ui/screens/Library.svelte'),
  Results: () => import('./ui/screens/Results.svelte'),
  Room: () => import('./ui/screens/Room.svelte'),
  TileEdit: () => import('./ui/screens/TileEdit.svelte'),
  Wizard: () => import('./ui/screens/Wizard.svelte'),
  PatternPicker: () => import('./ui/components/PatternPicker.svelte'),
  PlanPreview: () => import('./ui/components/PlanPreview.svelte'),
};
