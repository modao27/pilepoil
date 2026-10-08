import type { ModuleId, Progress } from '../modules/types';

/** Messages vers le worker : chaque calcul est aiguillé vers le moteur de son module (docs/BOITE.md §6). */
export type Request =
  | { type: 'compute'; id: number; module: ModuleId; spec: unknown }
  | { type: 'optimize'; id: number; module: ModuleId; spec: unknown }
  | { type: 'cancel'; id: number };

/** Messages du worker. */
export type Response =
  | { type: 'result'; id: number; result: unknown }
  | { type: 'progress'; id: number; progress: Progress }
  | { type: 'optimized'; id: number; result: unknown }
  | { type: 'cancelled'; id: number }
  | { type: 'error'; id: number; message: string };
