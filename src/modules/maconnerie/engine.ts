/** Face moteur de la maçonnerie (docs/BOITE.md §2) : pure, importée seulement par modules/engines.ts. */
import type { ModuleEngine } from '../types';
import { computeMaconnerie, type MaconnerieResult, type MaconnerieSpec } from './core/compute';

export const engine: ModuleEngine<MaconnerieSpec, MaconnerieResult> = {
  id: 'maconnerie',
  compute: (spec) => computeMaconnerie(spec),
};
