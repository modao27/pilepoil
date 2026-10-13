/** Durée de la dérivation du plan après travaux (docs/cloisons/SPEC.md §9). Projet « perf » : lancé seul. */
import { describe, expect, it } from 'vitest';
import { derive } from '../../src/core/plan/derive';
import type { Partition, PlanRoom, Site } from '../../src/core/plan/types';
import { rect } from '../unit/planFixtures';

/** 30 pièces de 6 × 4 m, une cloison dans chacune et dix cloisons en T. */
function build(dx = 0): Site {
  const rooms: PlanRoom[] = [];
  for (let i = 0; i < 30; i++)
    rooms.push({ ...rect(`r${i}`, 6000, 4000), origin: [(i % 6) * 6200, Math.floor(i / 6) * 4200] });
  const partitions: Partition[] = [];
  const part = (id: string, a: [number, number], b: [number, number]): Partition => ({
    id,
    a,
    b,
    thickness: 72,
    align: 'center',
    openings: [],
  });
  for (let i = 0; i < 30; i++) {
    const [ox, oy] = rooms[i]!.origin;
    partitions.push(part(`c${i}`, [ox + 3000 + (i === 0 ? dx : 0), oy], [ox + 3000 + (i === 0 ? dx : 0), oy + 4000]));
  }
  for (let i = 1; i < 10; i++) {
    const [ox, oy] = rooms[i]!.origin;
    partitions.push(part(`t${i}`, [ox + 3000, oy + 2000], [ox + 6000, oy + 2000]));
  }
  return { existing: { rooms, passages: [] }, partitions, demolitions: [] };
}

const median = (f: () => void, n = 7) => {
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = performance.now();
    f();
    t.push(performance.now() - s);
  }
  return t.sort((a, b) => a - b)[Math.floor(n / 2)]!;
};

describe('performances', () => {
  it('30 pièces et 40 cloisons à froid : moins de 30 ms', () => {
    derive(build()); // chauffe
    const ms = median(() => expect(derive(build()).plan.rooms.length).toBeGreaterThan(55));
    expect(ms).toBeLessThan(30);
  });

  it('glisser une cloison parmi 40 : moins de 10 ms (les groupes inchangés sont repris)', () => {
    const base = build();
    derive(base);
    let k = 0;
    const ms = median(() => {
      // mêmes pièces et mêmes cloisons que `base`, sauf la première cloison
      const moved: Site = {
        ...base,
        partitions: [{ ...base.partitions[0]!, a: [3000 + ++k, 0], b: [3000 + k, 4000] }, ...base.partitions.slice(1)],
      };
      derive(moved);
    });
    expect(ms).toBeLessThan(10);
  });
});
