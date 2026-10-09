/** Optimisation du départ (docs/parquet/SPEC.md §4.2.8) : R1, jamais moins bon, déterministe, interruptible. */
import { describe, expect, it } from 'vitest';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { candidatesOf, optimizeLayout, type OptimizeResult } from '../../src/modules/parquet/core/optimize';
import type { ParquetSpec } from '../../src/modules/parquet/core/types';
import { expectInvariants, rect, spec } from './parquetHelpers';

function run(s: ParquetSpec, id = 'L1'): { result: OptimizeResult; steps: number } {
  const g = optimizeLayout({ spec: s, layoutId: id });
  let steps = 0;
  for (;;) {
    const n = g.next();
    if (n.done) return { result: n.value, steps };
    steps++;
    expect(n.value.percent).toBeGreaterThan(0);
    expect(n.value.percent).toBeLessThanOrEqual(100);
  }
}

const apply = (s: ParquetSpec, r: OptimizeResult): ParquetSpec => ({
  ...s,
  layouts: s.layouts.map((l) => (l.id === r.layoutId ? { ...l, offset: r.offset, seed: r.seed } : l)),
});

describe('optimisation du départ', () => {
  it('R1 : au plus 52 lames après optimisation, jamais plus qu’avant', () => {
    const s = spec(rect(4000, 3000));
    const before = computeParquet(s).totals.boards;
    const { result, steps } = run(s);
    // coupe perdue : 20 décalages × 10 graines, moins le départ actuel
    expect(steps).toBe(199);
    expect(result.after.total).toBeLessThanOrEqual(result.before.total);
    const after = computeParquet(apply(s, result));
    expect(after.totals.boards).toBeLessThanOrEqual(52);
    expect(after.totals.boards).toBeLessThanOrEqual(before);
    expect(result.after.boards).toBe(after.totals.boards);
    expectInvariants(after.layouts[0]!, apply(s, result).layouts[0]!, 3);
  });

  it('déterministe ; relancée sur son résultat, elle ne change plus rien', () => {
    const s = spec(rect(3700, 2650), { pattern: { kind: 'regular-stagger', step: 1 / 3 } });
    const a = run(s).result;
    expect(run(structuredClone(s)).result).toEqual(a);
    const again = run(apply(s, a)).result;
    expect(again.after.total).toBeLessThanOrEqual(a.after.total + 1e-6);
  });

  it('longueurs mixtes : 20 décalages × 10 graines', () => {
    const l = spec(rect(3000, 2000), {
      board: {
        id: 'm',
        lengths: [400, 600, 900],
        lengthMix: [0.3, 0.4, 0.3],
        width: 70,
        thickness: 14,
        handed: false,
        boardsPerPack: 20,
      },
    }).layouts[0]!;
    expect(candidatesOf(l)).toHaveLength(20 * 10 - 1);
  });

  it('motif : essais sur une période, résultat appliqué valide', () => {
    const s = spec(rect(3000, 2000), {
      board: { id: 'b', lengths: [600], lengthMix: null, width: 100, thickness: 10, handed: true, boardsPerPack: 12 },
      pattern: { kind: 'herringbone' },
      axis: 'room-center',
    });
    const { result } = run(s);
    expect(result.after.total).toBeLessThanOrEqual(result.before.total);
    const l = computeParquet(apply(s, result)).layouts[0]!;
    expect(l.errors).toEqual([]);
    expectInvariants(l, apply(s, result).layouts[0]!, 3);
  });

  it('interruptible : return() arrête le générateur', () => {
    const g = optimizeLayout({ spec: spec(rect(4000, 3000)), layoutId: 'L1' });
    g.next();
    g.next();
    expect(g.return(undefined as never).done).toBe(true);
    expect(g.next().done).toBe(true);
  });

  it('pose inconnue ou sans lame : rien à faire', () => {
    expect(run(spec(rect(4000, 3000)), 'x').result.improved).toBe(false);
  });
});

describe('performances (SPEC §6)', () => {
  it('100 m² en point de Hongrie, optimisation comprise : sous 2 s (garde à 3 s, tests en parallèle)', () => {
    const s = spec(rect(10000, 10000), {
      board: { id: 'b', lengths: [600], lengthMix: null, width: 90, thickness: 10, handed: true, boardsPerPack: 12 },
      pattern: { kind: 'chevron', endAngle: 45 },
      axis: 'room-center',
    });
    const t0 = performance.now();
    const { result } = run(s);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(result.after.total).toBeLessThanOrEqual(result.before.total);
  }, 20000);
});
