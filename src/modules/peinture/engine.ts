/** Face moteur de la peinture (docs/BOITE.md §2) : pure, importée seulement par modules/engines.ts. */
import type { ModuleEngine } from '../types';
import { computePeinture } from './core/compute';
import type { PeintureResult, PeintureSpec } from './core/types';

export const engine: ModuleEngine<PeintureSpec, PeintureResult> = {
  id: 'peinture',
  compute: (spec) => computePeinture(spec),
};
