/** Durée du calcul des cloisons (docs/cloisons/SPEC.md §9). Projet « perf » : lancé seul. */
import { describe, expect, it } from 'vitest';
import { computeCloisons } from '../../src/modules/cloisons/core/compute';
import { door, part, spec } from '../unit/cloisonsHelpers';

describe('performances', () => {
  it('20 cloisons d’un appartement, portes comprises : moins de 100 ms', () => {
    const list = Array.from({ length: 20 }, (_, i) =>
      part(`p${i}`, {
        length: 2400 + (i % 5) * 700,
        system: i % 3 === 0 ? 's98' : 's72',
        spacing: i % 2 ? 400 : 600,
        openings: i % 2 ? [door(900 + i * 10, 830, 2040, `d${i}`)] : [],
        junctions: i % 4 === 0 ? [1200] : [],
        plates: { a: 'standard', b: i % 3 === 0 ? 'hydro' : 'standard' },
        insulation: i % 3 === 0 ? { kind: 'glass-wool' } : null,
      }),
    );
    const s = spec(list);
    computeCloisons(s); // chauffe
    const t: number[] = [];
    for (let i = 0; i < 7; i++) {
      const start = performance.now();
      computeCloisons(s);
      t.push(performance.now() - start);
    }
    t.sort((a, b) => a - b);
    expect(t[3]!).toBeLessThan(100);
  });
});
