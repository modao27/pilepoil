import { describe, expect, it } from 'vitest';
import {
  computeProject,
  optimizeZonesSync,
  type OptimizeResult,
  type ProjectResult,
  type ProjectSpec,
} from '../../src/modules/carrelage/core';
import type { AnyEngine } from '../../src/modules/engines';
import { createComputeClient, SupersededError, type Port } from '../../src/workers/client';
import { createHandler } from '../../src/workers/handler';
import type { Request, Response } from '../../src/workers/protocol';
import { surface, zone } from './fixtures';

const settings = { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20 };
const spec = (width = 3000): ProjectSpec => ({ surfaces: [surface({ width })], settings, room: null });

/** Environnement simulé : file de tâches différées et horloge qui avance de 5 ms à chaque lecture. */
function sim(engines?: Record<string, AnyEngine>) {
  const out: Response[] = [],
    queue: (() => void)[] = [];
  let t = 0;
  const env = { post: (m: Response) => out.push(m), defer: (f: () => void) => queue.push(f), now: () => (t += 5) };
  const handle = createHandler(env, engines);
  const flush = (max = Infinity) => {
    for (let n = 0; queue.length && n < max; n++) queue.shift()!();
  };
  return { out, handle, flush };
}

describe('logique du worker', () => {
  it('ne calcule que la dernière demande en attente', () => {
    const { out, handle, flush } = sim();
    handle({ type: 'compute', id: 1, module: 'carrelage', spec: spec(1000) });
    handle({ type: 'compute', id: 2, module: 'carrelage', spec: spec(2000) });
    handle({ type: 'compute', id: 3, module: 'carrelage', spec: spec(3000) });
    flush();
    expect(out.map((m) => [m.type, m.id])).toEqual([
      ['cancelled', 1],
      ['cancelled', 2],
      ['result', 3],
    ]);
    const r = out[2] as Extract<Response, { type: 'result' }>;
    expect((r.result as ProjectResult).metrics).toEqual(computeProject(spec(3000)).metrics);
  });

  it('annule un calcul en attente', () => {
    const { out, handle, flush } = sim();
    handle({ type: 'compute', id: 1, module: 'carrelage', spec: spec() });
    handle({ type: 'cancel', id: 1 });
    flush();
    expect(out).toEqual([{ type: 'cancelled', id: 1 }]);
  });

  it('optimise par tranches avec progression, même résultat que le calcul direct', () => {
    const { out, handle, flush } = sim();
    const s = surface({ width: 2400, height: 1800, zones: [zone({ pattern: 'grid', offsetX: 210 })] });
    handle({ type: 'optimize', id: 7, module: 'carrelage', spec: { surface: s, zones: [0], goal: 'thin', settings } });
    flush();
    const progress = out.filter((m) => m.type === 'progress');
    expect(progress.length).toBeGreaterThan(2);
    expect(progress[0]).toMatchObject({ progress: { part: 0 } });
    const done = out.at(-1) as Extract<Response, { type: 'optimized' }>;
    expect(done.type).toBe('optimized');
    expect(done.result).toEqual(optimizeZonesSync(s, [0], 'thin', settings));
  });

  it('arrête une optimisation annulée', () => {
    const { out, handle, flush } = sim();
    handle({
      type: 'optimize',
      id: 7,
      module: 'carrelage',
      spec: { surface: surface(), zones: [0], goal: 'tiles', settings },
    });
    flush(1);
    handle({ type: 'cancel', id: 7 });
    flush();
    expect(out.at(-1)).toEqual({ type: 'cancelled', id: 7 });
    expect(out.some((m) => m.type === 'optimized')).toBe(false);
  });

  it('signale une erreur de calcul', () => {
    const { out, handle, flush } = sim();
    handle({ type: 'compute', id: 1, module: 'carrelage', spec: { surfaces: null } });
    flush();
    expect(out[0]).toMatchObject({ type: 'error', id: 1 });
  });

  it('aiguille par module : un dernier calcul en attente par module', () => {
    const echo = (name: string): AnyEngine => ({ id: name, compute: (spec) => [name, spec] });
    const { out, handle, flush } = sim({ a: echo('a'), b: echo('b') });
    handle({ type: 'compute', id: 1, module: 'a', spec: 1 });
    handle({ type: 'compute', id: 2, module: 'b', spec: 2 });
    handle({ type: 'compute', id: 3, module: 'a', spec: 3 });
    flush();
    expect(out).toEqual([
      { type: 'cancelled', id: 1 },
      { type: 'result', id: 3, result: ['a', 3] },
      { type: 'result', id: 2, result: ['b', 2] },
    ]);
  });

  it('module inconnu ou sans optimisation : erreur', () => {
    const { out, handle, flush } = sim({ a: { id: 'a', compute: () => 0 } });
    handle({ type: 'compute', id: 1, module: 'toString', spec: null });
    handle({ type: 'optimize', id: 2, module: 'a', spec: null });
    flush();
    expect(out).toEqual([
      { type: 'error', id: 2, message: 'Le module a n’a pas d’optimisation.' },
      { type: 'error', id: 1, message: 'Module inconnu : toString' },
    ]);
  });
});

/** Canal simulé entre client et logique du worker, asynchrone comme postMessage. */
function fakePort(): Port {
  const listeners: ((e: { data: Response }) => void)[] = [];
  const handle = createHandler({
    post: (m) => setTimeout(() => listeners.forEach((f) => f({ data: m })), 0),
    defer: (f) => setTimeout(f, 0),
    now: () => performance.now(),
  });
  return {
    postMessage: (m: Request) => setTimeout(() => handle(m), 0),
    addEventListener: (_t, f) => void listeners.push(f),
  };
}

describe('client', () => {
  it('une demande dépassée est rejetée, la dernière aboutit', async () => {
    const c = createComputeClient(fakePort());
    const first = c.compute<ProjectResult>('carrelage', spec(1000));
    const last = c.compute<ProjectResult>('carrelage', spec(2000));
    await expect(first).rejects.toBeInstanceOf(SupersededError);
    expect((await last).metrics).toEqual(computeProject(spec(2000)).metrics);
  });

  it('optimisation : progression puis résultat', async () => {
    const c = createComputeClient(fakePort());
    const seen: number[] = [];
    const r = await c.optimize<OptimizeResult>(
      'carrelage',
      { surface: surface(), zones: [0], goal: 'bal', settings },
      { onProgress: (p) => seen.push(p.percent) },
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(r.zones).toHaveLength(1);
  });

  it('optimisation interrompue par AbortSignal', async () => {
    const c = createComputeClient(fakePort());
    const ctl = new AbortController();
    const opt = { surface: surface(), zones: [0], goal: 'thin', settings };
    const p = c.optimize('carrelage', opt, { onProgress: () => ctl.abort(), signal: ctl.signal });
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    const pre = new AbortController();
    pre.abort();
    await expect(c.optimize('carrelage', opt, { signal: pre.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
