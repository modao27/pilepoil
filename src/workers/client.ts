import type {
  OptimizeProgress,
  OptimizeResult,
  OptimizerGoal,
  ProjectResult,
  ProjectSpec,
  Settings,
  SurfaceSpec,
} from '../modules/carrelage';
import type { Request, Response } from './protocol';

/** Canal vers le worker (un Worker, ou un faux canal en test). */
export interface Port {
  postMessage(msg: Request): void;
  addEventListener(type: 'message', fn: (e: { data: Response }) => void): void;
}

/** Calcul remplacé par une demande plus récente : l'interface l'ignore. */
export class SupersededError extends Error {
  constructor() {
    super('Calcul remplacé par une demande plus récente.');
    this.name = 'SupersededError';
  }
}

export interface ComputeClient {
  /** Calcule le projet ; la promesse d'une demande dépassée est rejetée avec SupersededError. */
  compute(spec: ProjectSpec): Promise<ProjectResult>;
  /** Optimise des zones ; abort via signal (rejet AbortError). */
  optimize(
    surface: SurfaceSpec,
    zones: number[],
    goal: OptimizerGoal,
    settings: Settings,
    opts?: { onProgress?: (p: OptimizeProgress) => void; signal?: AbortSignal },
  ): Promise<OptimizeResult>;
}

interface Waiting {
  kind: 'compute' | 'optimize';
  resolve(v: never): void;
  reject(e: unknown): void;
  onProgress?: (p: OptimizeProgress) => void;
}

const abortError = () => new DOMException('Optimisation annulée.', 'AbortError');

export function createComputeClient(port: Port): ComputeClient {
  let seq = 0,
    latestCompute = 0;
  const waiting = new Map<number, Waiting>();

  port.addEventListener('message', ({ data: m }) => {
    const w = waiting.get(m.id);
    if (!w) return;
    switch (m.type) {
      case 'progress':
        w.onProgress?.({ zone: m.zone, percent: m.percent });
        return;
      case 'result':
        waiting.delete(m.id);
        if (m.id < latestCompute) w.reject(new SupersededError());
        else w.resolve(m.result as never);
        return;
      case 'optimized':
        waiting.delete(m.id);
        w.resolve(m.result as never);
        return;
      case 'cancelled':
        waiting.delete(m.id);
        w.reject(w.kind === 'compute' ? new SupersededError() : abortError());
        return;
      case 'error':
        waiting.delete(m.id);
        w.reject(new Error(m.message));
        return;
    }
  });

  return {
    compute(spec) {
      const id = ++seq;
      latestCompute = id;
      return new Promise<ProjectResult>((resolve, reject) => {
        waiting.set(id, { kind: 'compute', resolve: resolve as (v: never) => void, reject });
        port.postMessage({ type: 'compute', id, spec });
      });
    },
    optimize(surface, zones, goal, settings, opts = {}) {
      const id = ++seq;
      return new Promise<OptimizeResult>((resolve, reject) => {
        if (opts.signal?.aborted) return reject(abortError());
        waiting.set(id, {
          kind: 'optimize',
          resolve: resolve as (v: never) => void,
          reject,
          onProgress: opts.onProgress,
        });
        opts.signal?.addEventListener(
          'abort',
          () => {
            if (!waiting.delete(id)) return;
            port.postMessage({ type: 'cancel', id });
            reject(abortError());
          },
          { once: true },
        );
        port.postMessage({ type: 'optimize', id, surface, zones, goal, settings });
      });
    },
  };
}

/** Client branché sur le worker de l'application. */
export function createWorkerClient(): ComputeClient {
  const worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' });
  return createComputeClient(worker as unknown as Port);
}
