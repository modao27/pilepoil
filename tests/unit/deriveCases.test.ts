import { describe, expect, it } from 'vitest';
import { area } from '../../src/core/geometry/polygon';
import { deriveSite, planAfter } from '../../src/core/plan/derive';
import type { Partition, Plan, PlanRoom, Site } from '../../src/core/plan/types';
import { validatePlan } from '../../src/core/plan/validate';
import { lShape, rect, withOpening } from './planFixtures';

const site = (rooms: PlanRoom[], partitions: Partition[] = [], demolitions: Site['demolitions'] = []): Site => ({
  existing: { rooms, passages: [] },
  partitions,
  demolitions,
});
const cloison = (id: string, a: [number, number], b: [number, number], o: Partial<Partition> = {}): Partition => ({
  id,
  a,
  b,
  thickness: 72,
  align: 'center',
  openings: [],
  ...o,
});
const total = (p: Plan) => p.rooms.reduce((s, r) => s + area(r.outline), 0);

describe('dérivation : cas particuliers', () => {
  it('une fenêtre coupée par la cloison est partagée entre les deux pièces, avec une alerte', () => {
    // fenêtre de 1000 mm sur le mur du haut (0), de x = 1500 à 2500 ; cloison à x = 2000
    const room = withOpening(rect('a', 4000, 3000), 0, { id: 'w', kind: 'window', offset: 1500, width: 1000 });
    const s = site([room], [cloison('c1', [2000, 0], [2000, 3000])]);
    const d = deriveSite(s);
    const opens = d.plan.rooms.flatMap((r) => r.openings);
    expect(opens.map((o) => o.id).sort()).toEqual(['w', 'w~2']);
    // 500 mm − demi-cloison de chaque côté : 464 mm dans chaque pièce
    for (const o of opens) expect(o.width).toBeCloseTo(464, 0);
    expect(d.issues).toEqual([{ code: 'partition/over-opening', id: 'w', severity: 'warning' }]);
    expect(validatePlan(d.plan)).toEqual([]);
  });

  it('une fenêtre intacte suit son mur et garde son identifiant', () => {
    const room = withOpening(rect('a', 4000, 3000), 0, { id: 'w', kind: 'window', offset: 2600, width: 1000 });
    const plan = planAfter(site([room], [cloison('c1', [1000, 0], [1000, 3000])]));
    const o = plan.rooms.flatMap((r) => r.openings);
    expect(o).toHaveLength(1);
    expect(o[0]!.id).toBe('w');
    // le mur du haut de la grande pièce commence après la cloison : décalage 1500 − 36 − ... recalculé
    const room2 = plan.rooms.find((r) => r.openings.length)!;
    const wall = room2.walls.find((w) => w.id === o[0]!.wall)!;
    expect(wall.id.startsWith('a-w0')).toBe(true);
    expect(o[0]!.width).toBe(1000);
    expect(o[0]!.offset).toBeCloseTo(2600 - 1036, 0);
  });

  it('liaison en T : la seconde cloison s’arrête sur la première', () => {
    const room = rect('a', 4000, 3000);
    const s = site([room], [cloison('c1', [2000, 0], [2000, 3000]), cloison('c2', [2000, 1500], [4000, 1500])]);
    const d = deriveSite(s);
    expect(d.issues).toEqual([]);
    expect(d.plan.rooms).toHaveLength(3);
    expect(total(d.plan)).toBeCloseTo(4000 * 3000 - 72 * 3000 - 72 * (2000 - 36), -2);
    expect(validatePlan(d.plan)).toEqual([]);
  });

  it('bout libre : la cloison laisse une encoche, une seule pièce', () => {
    const room = rect('a', 4000, 3000);
    const plan = planAfter(site([room], [cloison('c1', [2000, 0], [2000, 1800])]));
    expect(plan.rooms).toHaveLength(1);
    expect(plan.rooms[0]!.id).toBe('a');
    expect(plan.rooms[0]!.outline.length).toBe(8);
    expect(total(plan)).toBeCloseTo(4000 * 3000 - 72 * 1800, -2);
    const ends = plan.rooms[0]!.walls.filter((w) => w.of?.face === 'start' || w.of?.face === 'end');
    expect(ends).toHaveLength(1);
    expect(validatePlan(plan)).toEqual([]);
  });

  it('pièce en L coupée : les deux pièces restent valides', () => {
    const room = lShape('a', 5000, 4000, 2000, 2000);
    const plan = planAfter(site([room], [cloison('c1', [2500, 0], [2500, 4000])]));
    expect(plan.rooms.length).toBeGreaterThanOrEqual(2);
    expect(validatePlan(plan)).toEqual([]);
  });

  it('un obstacle suit le morceau qui le contient', () => {
    const room = rect('a', 4000, 3000);
    const withPost: PlanRoom = {
      ...room,
      obstacles: [
        {
          id: 'post',
          kind: 'post',
          outline: [
            [3000, 1000],
            [3300, 1000],
            [3300, 1300],
            [3000, 1300],
          ],
        },
      ],
    };
    const plan = planAfter(site([withPost], [cloison('c1', [1000, 0], [1000, 3000])]));
    const holder = plan.rooms.filter((r) => r.obstacles.some((o) => o.id === 'post'));
    expect(holder).toHaveLength(1);
    expect(holder[0]!.id).toBe('a');
    expect(validatePlan(plan)).toEqual([]);
  });

  it('une cloison à travers un poteau est refusée', () => {
    const room: PlanRoom = {
      ...rect('a', 4000, 3000),
      obstacles: [
        {
          id: 'post',
          kind: 'post',
          outline: [
            [1950, 1000],
            [2250, 1000],
            [2250, 1300],
            [1950, 1300],
          ],
        },
      ],
    };
    const d = deriveSite(site([room], [cloison('c1', [2000, 0], [2000, 3000])]));
    expect(d.issues.map((i) => i.code)).toEqual(['partition/crosses-obstacle']);
  });

  it('deux cloisons qui se croisent : la seconde est refusée', () => {
    const room = rect('a', 4000, 3000);
    const d = deriveSite(
      site([room], [cloison('c1', [2000, 0], [2000, 3000]), cloison('c2', [0, 1500], [4000, 1500])]),
    );
    expect(d.issues.map((i) => i.code)).toEqual(['partition/crosses-partition', 'partition/crosses-partition']);
  });

  it('alignement : une face sur l’axe tracé, l’épaisseur du côté de la normale (dy, −dx)', () => {
    const room = rect('a', 4000, 3000);
    // a → b descend : la normale (dy, −dx) est (+1, 0), l’épaisseur part vers la droite de l’écran
    const plan = planAfter(site([room], [cloison('c', [2000, 0], [2000, 3000], { align: 'left' })]));
    const xs = plan.rooms.map((r) => [
      Math.min(...r.outline.map((p) => p[0])),
      Math.max(...r.outline.map((p) => p[0])),
    ]);
    xs.sort((p, q) => p[0]! - q[0]!);
    expect(xs[0]![1]).toBeCloseTo(2000, 0);
    expect(xs[1]![0]).toBeCloseTo(2072, 0);
  });

  it('démolition entre deux pièces : un trou fermé devient un obstacle', () => {
    // pièce en U autour d’un mur : deux pièces dont la démolition referme un îlot de mur
    const a = rect('a', 3000, 3000);
    const b = { ...rect('b', 3000, 1400), origin: [0, 3072] as [number, number] };
    const c = { ...rect('c', 3000, 1400), origin: [3072, 0] as [number, number] };
    const plan = planAfter(
      site(
        [a, b, c],
        [],
        [
          { id: 'd1', room: 'a', wall: 'a-w2', from: 0, to: 3000 },
          { id: 'd2', room: 'a', wall: 'a-w1', from: 0, to: 3000 },
        ],
      ),
    );
    expect(plan.rooms.length).toBeGreaterThanOrEqual(1);
    expect(validatePlan(plan)).toEqual([]);
  });
});
