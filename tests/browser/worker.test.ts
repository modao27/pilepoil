import { describe, expect, it } from 'vitest';
import {
  computeProject,
  type OptimizeResult,
  type ProjectResult,
  type ProjectSpec,
} from '../../src/modules/carrelage/core';
import { createWorkerClient } from '../../src/workers/client';
import { surface, zone } from '../unit/fixtures';

const settings = { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20 };

describe('worker de calcul réel', () => {
  it('calcule dans le worker le même résultat que sur le fil principal', async () => {
    const spec: ProjectSpec = {
      surfaces: [surface({ zones: [zone({ pattern: 'herring', angle: 45 })] })],
      settings,
      room: null,
    };
    const client = createWorkerClient();
    const r = await client.compute<ProjectResult>('carrelage', spec);
    const direct = computeProject(spec);
    expect(r.metrics).toEqual(direct.metrics);
    expect(r.plan).toEqual(direct.plan);
  });

  it('optimise avec progression', async () => {
    const client = createWorkerClient();
    let calls = 0;
    const r = await client.optimize<OptimizeResult>(
      'carrelage',
      { surface: surface(), zones: [0], goal: 'thin', settings },
      { onProgress: () => calls++ },
    );
    expect(calls).toBeGreaterThan(0);
    expect(r.zones[0]).toHaveProperty('offsetX');
  });
});
