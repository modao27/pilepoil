/** Face moteur du carrelage (docs/BOITE.md §2) : pure, importée seulement par modules/engines.ts. */
import type { ModuleEngine } from '../types';
import {
  computeProject,
  optimizeZones,
  type OptimizeResult,
  type OptimizerGoal,
  type ProjectResult,
  type ProjectSpec,
  type Settings,
  type SurfaceSpec,
} from './core';

/** Optimisation de zones d'une surface. */
export interface OptimizeSpec {
  surface: SurfaceSpec;
  zones: number[];
  goal: OptimizerGoal;
  settings: Settings;
}

export const engine: ModuleEngine<ProjectSpec, ProjectResult, OptimizeSpec, OptimizeResult> = {
  id: 'carrelage',
  compute: (spec) => computeProject(spec),
  *optimize(spec) {
    const job = optimizeZones(spec.surface, spec.zones, spec.goal, spec.settings);
    for (;;) {
      const r = job.next();
      if (r.done) return r.value;
      yield { percent: r.value.percent, part: r.value.zone };
    }
  },
};
