/** Cloisons de hauteur propre (N3) : faces plus basses, muret obstacle quand la cloison ne traverse pas la pièce. */
import { describe, expect, it } from 'vitest';
import { planAfter, deriveSite } from '../../src/core/plan/derive';
import { wallHeight } from '../../src/core/plan/levels';
import type { Partition, Site } from '../../src/core/plan/types';
import { validatePlan } from '../../src/core/plan/validate';
import { area } from '../../src/core/geometry/polygon';
import { rect } from './planFixtures';

const room = rect('a', 4000, 3000, { height: 2500 });
const cloison = (id: string, a: [number, number], b: [number, number], o: Partial<Partition> = {}): Partition => ({
  id,
  a,
  b,
  thickness: 72,
  align: 'center',
  openings: [],
  ...o,
});
const site = (...partitions: Partition[]): Site => ({
  existing: { rooms: [room], passages: [] },
  partitions,
  demolitions: [],
});
const faces = (s: Site) =>
  planAfter(s)
    .rooms.flatMap((r) => r.walls.map((w) => ({ r, w })))
    .filter((x) => x.w.of);

describe('cloison de hauteur propre qui traverse la pièce', () => {
  const across = (h?: number) => cloison('c1', [2000, 0], [2000, 3000], h != null ? { height: h } : {});

  it('sépare la pièce en deux, ses faces portent sa hauteur', () => {
    const s = site(across(900));
    expect(planAfter(s).rooms).toHaveLength(2);
    expect(deriveSite(s).lowObstacles).toEqual([]);
    const f = faces(s);
    expect(f.length).toBeGreaterThanOrEqual(2);
    for (const { r, w } of f) expect(wallHeight(r, w), w.id).toBe(900);
    // les autres murs gardent la hauteur de la pièce
    const others = planAfter(s).rooms.flatMap((r) => r.walls.filter((w) => !w.of).map((w) => wallHeight(r, w)));
    expect(new Set(others)).toEqual(new Set([2500]));
    expect(validatePlan(planAfter(s))).toEqual([]);
  });

  it('sans hauteur propre : exactement comme avant (aucune hauteur sur les faces)', () => {
    const s = site(across());
    for (const { w } of faces(s)) expect('height' in w).toBe(false);
    expect(deriveSite(s).lowObstacles).toEqual([]);
  });

  it('une hauteur au plafond ou au-dessus : la pièce garde ses murs pleins', () => {
    for (const h of [2500, 3000]) {
      const s = site(across(h));
      for (const { r, w } of faces(s)) expect(wallHeight(r, w)).toBe(2500);
    }
  });
});

describe('cloison basse qui ne traverse pas la pièce : un muret', () => {
  it('bout contre un mur, bout libre : un obstacle, une seule pièce, sol entier moins le muret', () => {
    const s = site(cloison('c1', [2000, 0], [2000, 1500], { height: 900 }));
    expect(deriveSite(s).lowObstacles).toEqual(['c1']);
    const plan = planAfter(s);
    expect(plan.rooms).toHaveLength(1);
    const r = plan.rooms[0]!;
    expect(r.walls.filter((w) => w.of)).toEqual([]);
    expect(r.obstacles).toHaveLength(1);
    expect(r.obstacles[0]).toMatchObject({ id: 'c1~low1', kind: 'other', height: 900 });
    // son emprise : 72 mm de large, 1 500 mm de long (moins ce qui est dans le mur)
    expect(area(r.obstacles[0]!.outline)).toBeCloseTo(72 * 1500, -2);
    expect(area(r.outline)).toBeCloseTo(4000 * 3000, 0);
    expect(plan).not.toBe(s.existing);
  });

  it('les deux bouts libres, au milieu de la pièce : un obstacle', () => {
    const s = site(cloison('c1', [1000, 1500], [2500, 1500], { height: 1000 }));
    expect(deriveSite(s).lowObstacles).toEqual(['c1']);
    expect(planAfter(s).rooms[0]!.obstacles[0]).toMatchObject({ kind: 'other', height: 1000 });
    expect(planAfter(s).rooms).toHaveLength(1);
  });

  it('la même cloison pleine hauteur creuse un renfoncement dans le contour (comportement d’avant)', () => {
    const s = site(cloison('c1', [2000, 0], [2000, 1500]));
    const r = planAfter(s).rooms[0]!;
    expect(deriveSite(s).lowObstacles).toEqual([]);
    expect(r.obstacles).toHaveLength(0);
    expect(area(r.outline)).toBeLessThan(4000 * 3000);
  });

  it('un obstacle de muret est dans la pièce et trouble le sol revêtu', () => {
    const s = site(cloison('c1', [1000, 1500], [2500, 1500], { height: 1000 }));
    expect(validatePlan(planAfter(s))).toEqual([]);
  });

  it('hauteur nulle : refusée', () => {
    const s = site(cloison('c1', [2000, 0], [2000, 3000], { height: 0 }));
    expect(deriveSite(s).issues.map((i) => i.code)).toEqual(['partition/height']);
    expect(planAfter(s).rooms).toHaveLength(1);
  });
});
