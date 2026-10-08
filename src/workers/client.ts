import type { ModuleId, Progress } from '../modules/types';
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

export interface OptimizeOptions {
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
}

/**
 * Client du worker de calcul. Entrées et résultats ne sont pas vérifiés ici : chaque module appelle avec
 * le type de son moteur (`R` = résultat de son `compute` ou de son `optimize`).
 */
export interface ComputeClient {
  /** Calcule ; par module, la promesse d'une demande dépassée est rejetée avec SupersededError. */
  compute<R>(module: ModuleId, spec: unknown): Promise<R>;
  /** Optimise ; abort via signal (rejet AbortError). */
  optimize<R>(module: ModuleId, spec: unknown, opts?: OptimizeOptions): Promise<R>;
}

interface Waiting {
  kind: 'compute' | 'optimize';
  module: ModuleId;
  resolve(v: unknown): void;
  reject(e: unknown): void;
  onProgress?: (p: Progress) => void;
}

const abortError = () => new DOMException('Optimisation annulée.', 'AbortError');

export function createComputeClient(port: Port): ComputeClient {
  let seq = 0;
  /** Dernière demande de calcul de chaque module. */
  const latest = new Map<ModuleId, number>();
  const waiting = new Map<number, Waiting>();

  port.addEventListener('message', ({ data: m }) => {
    const w = waiting.get(m.id);
    if (!w) return;
    switch (m.type) {
      case 'progress':
        w.onProgress?.(m.progress);
        return;
      case 'result':
        waiting.delete(m.id);
        if (m.id < (latest.get(w.module) ?? 0)) w.reject(new SupersededError());
        else w.resolve(m.result);
        return;
      case 'optimized':
        waiting.delete(m.id);
        w.resolve(m.result);
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
    compute<R>(module: ModuleId, spec: unknown) {
      const id = ++seq;
      latest.set(module, id);
      return new Promise<R>((resolve, reject) => {
        waiting.set(id, { kind: 'compute', module, resolve: resolve as (v: unknown) => void, reject });
        port.postMessage({ type: 'compute', id, module, spec });
      });
    },
    optimize<R>(module: ModuleId, spec: unknown, opts: OptimizeOptions = {}) {
      const id = ++seq;
      return new Promise<R>((resolve, reject) => {
        if (opts.signal?.aborted) return reject(abortError());
        waiting.set(id, {
          kind: 'optimize',
          module,
          resolve: resolve as (v: unknown) => void,
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
        port.postMessage({ type: 'optimize', id, module, spec });
      });
    },
  };
}

/** Client branché sur le worker de l'application. */
export function createWorkerClient(): ComputeClient {
  const worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' });
  return createComputeClient(worker as unknown as Port);
}
