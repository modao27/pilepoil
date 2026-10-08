import { computeProject, optimizeZones, type OptimizeProgress, type OptimizeResult } from '../modules/carrelage';

import type { Request, Response } from './protocol';

/** Durée maximale d'une tranche d'optimisation avant de rendre la main (traitement des annulations). */
export const SLICE_MS = 12;

export interface HandlerEnv {
  post(msg: Response): void;
  /** Exécute fn plus tard, après les messages en attente (setTimeout 0 dans le worker). */
  defer(fn: () => void): void;
  now(): number;
}

/**
 * Logique du worker de calcul, indépendante de l'environnement :
 * - compute : seul le dernier calcul demandé est fait (les précédents en attente sont annulés) ;
 * - optimize : avance par tranches de SLICE_MS, envoie la progression, s'arrête sur cancel.
 */
export function createHandler(env: HandlerEnv): (req: Request) => void {
  let pending: Extract<Request, { type: 'compute' }> | null = null;
  let computeScheduled = false;
  const jobs = new Map<number, Generator<OptimizeProgress, OptimizeResult, void>>();

  const fail = (id: number, e: unknown) =>
    env.post({ type: 'error', id, message: e instanceof Error ? e.message : String(e) });

  const runCompute = () => {
    computeScheduled = false;
    const req = pending;
    pending = null;
    if (!req) return;
    try {
      env.post({ type: 'result', id: req.id, result: computeProject(req.spec) });
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
          env.post({ type: 'progress', id, zone: r.value.zone, percent: r.value.percent });
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
      case 'compute':
        if (pending) env.post({ type: 'cancelled', id: pending.id });
        pending = req;
        if (!computeScheduled) {
          computeScheduled = true;
          env.defer(runCompute);
        }
        return;
      case 'optimize':
        jobs.set(req.id, optimizeZones(req.surface, req.zones, req.goal, req.settings));
        env.defer(() => step(req.id));
        return;
      case 'cancel': {
        const job = jobs.get(req.id);
        if (job) {
          job.return(undefined as never);
          jobs.delete(req.id);
          env.post({ type: 'cancelled', id: req.id });
        } else if (pending?.id === req.id) {
          pending = null;
          env.post({ type: 'cancelled', id: req.id });
        }
        return;
      }
    }
  };
}
