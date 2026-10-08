import type {
  OptimizeResult,
  OptimizerGoal,
  ProjectResult,
  ProjectSpec,
  Settings,
  SurfaceSpec,
} from '../modules/carrelage';

/** Messages vers le worker. */
export type Request =
  | { type: 'compute'; id: number; spec: ProjectSpec }
  | { type: 'optimize'; id: number; surface: SurfaceSpec; zones: number[]; goal: OptimizerGoal; settings: Settings }
  | { type: 'cancel'; id: number };

/** Messages du worker. */
export type Response =
  | { type: 'result'; id: number; result: ProjectResult }
  | { type: 'progress'; id: number; zone: number; percent: number }
  | { type: 'optimized'; id: number; result: OptimizeResult }
  | { type: 'cancelled'; id: number }
  | { type: 'error'; id: number; message: string };
