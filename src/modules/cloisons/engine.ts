/** Face moteur des cloisons (docs/BOITE.md §2) : pure, importée seulement par modules/engines.ts (CL2). */
import type { ModuleEngine } from '../types';
import { computeCloisons } from './core/compute';
import type { CloisonsResult, CloisonsSpec } from './core/types';

export const engine: ModuleEngine<CloisonsSpec, CloisonsResult> = {
  id: 'cloisons',
  compute: (spec) => computeCloisons(spec),
};
