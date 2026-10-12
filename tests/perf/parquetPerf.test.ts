/**
 * Temps de calcul du parquet (docs/parquet/SPEC.md §6). Lancés seuls, après les autres tests (projet « perf »,
 * sans autre fichier en parallèle) : une mesure de durée ne dépend pas de la charge du reste de la suite.
 * Tout nouveau test de durée va ici.
 */
import { describe, expect, it } from 'vitest';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { optimizeLayout, type OptimizeResult } from '../../src/modules/parquet/core/optimize';
import type { ParquetSpec } from '../../src/modules/parquet/core/types';
import { rect, spec } from '../unit/parquetHelpers';

function run(s: ParquetSpec, id = 'L1'): { result: OptimizeResult } {
  const g = optimizeLayout({ spec: s, layoutId: id });
  for (;;) {
    const n = g.next();
    if (n.done) return { result: n.value };
  }
}

describe('performances', () => {
  it('30 m² en pose droite : moins de 300 ms', () => {
    const s = spec(rect(6000, 5000), { angle: 0 });
    computeParquet(s); // chauffe (compilation à la volée)
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      computeParquet(s);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const median = times[2]!;
    console.log(`parquet 30 m² : médiane ${median.toFixed(1)} ms (${times.map((x) => x.toFixed(0)).join(', ')})`);
    expect(median).toBeLessThan(300);
    // en diagonale, plus de pièces coupées : même exigence
    const d = spec(rect(6000, 5000), { angle: 45 });
    computeParquet(d);
    const t = performance.now();
    computeParquet(d);
    expect(performance.now() - t).toBeLessThan(300);
  });
});

describe('performances (SPEC §6)', () => {
  it('100 m² en point de Hongrie, optimisation comprise : sous 2 s (garde à 3 s)', () => {
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
