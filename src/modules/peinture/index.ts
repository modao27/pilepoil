/**
 * Point d'entrée du module peinture (face application) : le `ToolModule`, vu par la coquille via le registre.
 * La face moteur est engine.ts (importée par modules/engines.ts).
 */
import type { LibraryDefinition, ModuleManifest } from '../types';
import { PAINT_SCHEMA, PAINT_TEMPLATES } from './core/paint';
import { PAINT_CATALOG } from './core/catalog';
import type { PeintureResult, PeintureSpec } from './core/types';
import type { Action } from './state/actions';
import { PEINTURE_RULES } from './state/ids';
import { PEINTURE_ID, PEINTURE_SCHEMA, type PeintureData } from './state/model';
import { usesPaint } from './state/usage';

/** Bibliothèque de peintures (#/library/paints). */
export const library: LibraryDefinition = {
  id: 'paints',
  label: 'Peintures',
  store: 'paints',
  schemaVersion: PAINT_SCHEMA,
  migrations: {},
  screens: {
    list: () => import('./ui/screens/PaintLibrary.svelte').then((m) => m.default),
    edit: () => import('./ui/screens/PaintEdit.svelte').then((m) => m.default),
  },
  templates: () =>
    [...PAINT_TEMPLATES, ...PAINT_CATALOG].map((p) => ({
      ...p,
      uses: [...p.uses],
      packs: p.packs.map((k) => ({ ...k })),
    })),
  usedIn: usesPaint,
};

/** Module peinture (docs/BOITE.md §2, docs/peinture/SPEC.md). */
export const module: ModuleManifest<PeintureData, PeintureSpec, PeintureResult, Action> = {
  id: PEINTURE_ID,
  label: 'Peinture',
  description: 'Peinture des murs : surface nette, couches, litres, pots, boiseries.',
  // rouleau à peinture sur un mur
  icon: '<rect x="2" y="2" width="30" height="20" rx="1.5"/><path fill="currentColor" fill-opacity=".18" stroke="none" d="M2 3.5A1.5 1.5 0 0 1 3.5 2H32v8H2z"/><path d="M2 10h30M17 10v4M17 14h-3v6h4v-6h-1"/>',
  schemaVersion: PEINTURE_SCHEMA,
  poseLabel: 'Réglages',
  coverage: PEINTURE_RULES,
  poseHref: (p, pose) => `#/p/${encodeURIComponent(p)}/m/peinture/pose/${encodeURIComponent(pose)}`,
  logic: () => import('./logic').then((m) => m.logic),
  results: () => import('./ui/lib/resultsModule').then((m) => m.results),
  migrations: {},
  screens: {
    editor: () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default),
    routes: [{ path: 'pose/:poseId', load: () => import('./ui/screens/EditorScreen.svelte').then((m) => m.default) }],
  },
  library,
};
