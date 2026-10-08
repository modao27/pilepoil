/** Face moteur du parquet (docs/BOITE.md §2) : pure, importée seulement par modules/engines.ts. */
import type { ModuleEngine } from '../types';
import { computeParquet } from './core/compute';
import type { ParquetResult, ParquetSpec } from './core/types';

export const engine: ModuleEngine<ParquetSpec, ParquetResult> = {
  id: 'parquet',
  compute: (spec) => computeParquet(spec),
  // optimisation du départ : P4
};
