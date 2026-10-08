import { engines as allEngines, type AnyEngine } from '../modules/engines';
import type { ModuleId, Progress } from '../modules/types';
import type { Request, Response } from './protocol';

/** Durée maximale d'une tranche d'optimisation avant de rendre la main (traitement des annulations). */
export const SLICE_MS = 12;

export interface HandlerEnv {
  post(msg: Response): void;
  /** Exécute fn plus tard, après les messages en attente (setTimeout 0 dans le worker). */
  defer(fn: () => void): void;
  now(): number;
}

type Compute = Extract<Request, { type: 'compute' }>;

/**
 * Logique du worker de calcul, indépendante de l'environnement, aiguillée par module :
 * - compute : par module, seul le dernier calcul demandé est fait (les précédents en attente sont annulés) ;
 * - optimize : avance par tranches de SLICE_MS, envoie la progression, s'arrête sur cancel.
 */
export function createHandler(
  env: HandlerEnv,
  engines: Readonly<Record<ModuleId, AnyEngine>> = allEngines,
): (req: Request) => void {
  /** Dernier calcul en attente de chaque module ; présent = exécution déjà programmée. */
  const pending = new Map<ModuleId, Compute | null>();
  const jobs = new Map<number, Generator<Progress, unknown, void>>();
  const ctx = { now: env.now };

  const fail = (id: number, e: unknown) =>
    env.post({ type: 'error', id, message: e instanceof Error ? e.message : String(e) });

  const engine = (module: ModuleId): AnyEngine => {
    const e = Object.hasOwn(engines, module) ? engines[module] : undefined;
    if (!e) throw new Error(`Module inconnu : ${module}`);
    return e;
  };

  const runCompute = (module: ModuleId) => {
    const req = pending.get(module);
    pending.delete(module);
    if (!req) return;
    try {
      env.post({ type: 'result', id: req.id, result: engine(module).compute(req.spec, ctx) });
    } catch (e) {
      fail(req.id, e);
    }
  };

  const step = (id: number) => {
    const job = jobs.get(id);
    if (!job) return;
    const end = env.now() + SLICE_MS;
    try {
      for (;;) {
        const r = job.next();
        if (r.done) {
          jobs.delete(id);
          env.post({ type: 'optimized', id, result: r.value });
          return;
        }
        if (env.now() >= end) {
          env.post({ type: 'progress', id, progress: r.value });
          env.defer(() => step(id));
          return;
        }
      }
    } catch (e) {
      jobs.delete(id);
      fail(id, e);
    }
  };

  return (req) => {
    switch (req.type) {
      case 'compute': {
        const waiting = pending.get(req.module);
        if (waiting) env.post({ type: 'cancelled', id: waiting.id });
        if (!pending.has(req.module)) env.defer(() => runCompute(req.module));
        pending.set(req.module, req);
        return;
      }
      case 'optimize':
        try {
          const e = engine(req.module);
          if (!e.optimize) throw new Error(`Le module ${req.module} n’a pas d’optimisation.`);
          jobs.set(req.id, e.optimize(req.spec, ctx));
        } catch (e) {
          fail(req.id, e);
          return;
        }
        env.defer(() => step(req.id));
        return;
      case 'cancel': {
        const job = jobs.get(req.id);
        if (job) {
          job.return(undefined);
          jobs.delete(req.id);
          env.post({ type: 'cancelled', id: req.id });
          return;
        }
        for (const [module, p] of pending)
          if (p?.id === req.id) {
            pending.set(module, null);
            env.post({ type: 'cancelled', id: req.id });
          }
        return;
      }
    }
  };
}
