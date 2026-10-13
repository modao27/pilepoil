import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { area } from '../../src/core/geometry/polygon';
import { deriveSite, planAfter } from '../../src/core/plan/derive';
import { facingWalls } from '../../src/core/plan/neighbors';
import type { Partition, Plan, PlanRoom, Site } from '../../src/core/plan/types';
import { validatePlan } from '../../src/core/plan/validate';
import { rect } from './planFixtures';

const site = (
  rooms: PlanRoom[],
  partitions: Partition[] = [],
  demolitions: Site['demolitions'] = [],
  passages: Plan['passages'] = [],
): Site => ({ existing: { rooms, passages }, partitions, demolitions });

const cloison = (id: string, a: [number, number], b: [number, number], o: Partial<Partition> = {}): Partition => ({
  id,
  a,
  b,
  thickness: 72,
  align: 'center',
  openings: [],
  ...o,
});

const roomArea = (r: PlanRoom) => area(r.outline);
const total = (p: Plan) => p.rooms.reduce((s, r) => s + roomArea(r), 0);

describe('plan après travaux : sans travaux', () => {
  it('même référence, aucun problème', () => {
    const s = site([rect('a', 4000, 3000)]);
    expect(planAfter(s)).toBe(s.existing);
    expect(deriveSite(s).issues).toEqual([]);
  });
});

describe('cloison', () => {
  const room = rect('a', 4000, 3000, { name: 'Séjour' });

  it('coupe une pièce en deux, murs en vis-à-vis à l’épaisseur de la cloison', () => {
    const s = site([room], [cloison('c1', [2000, 0], [2000, 3000])]);
    const plan = planAfter(s);
    expect(plan.rooms).toHaveLength(2);
    expect(total(plan)).toBeCloseTo(4000 * 3000 - 72 * 3000, -1);
    for (const r of plan.rooms) {
      expect(r.walls).toHaveLength(r.outline.length);
      expect(r.outline).toHaveLength(4);
      expect(roomArea(r)).toBeCloseTo(1964 * 3000, -1);
    }
    expect(validatePlan(plan)).toEqual([]);
    const faces = facingWalls(plan).filter((f) => f.a.wall.startsWith('c1:') || f.b.wall.startsWith('c1:'));
    expect(faces).toHaveLength(1);
    expect(deriveSite(s).issues).toEqual([]);
  });

  it('une pièce garde l’identité et le nom, l’autre est nouvelle', () => {
    const plan = planAfter(site([room], [cloison('c1', [2000, 0], [2000, 3000])]));
    const kept = plan.rooms.filter((r) => r.id === 'a');
    expect(kept).toHaveLength(1);
    expect(kept[0]!.name).toBe('Séjour');
    const other = plan.rooms.find((r) => r.id !== 'a')!;
    expect(other.id.startsWith('a~')).toBe(true);
    expect(other.name).toBe('Séjour (2)');
    expect(new Set(plan.rooms.map((r) => r.id)).size).toBe(2);
  });

  it('le morceau qui porte l’ancre garde l’identité, quelle que soit sa taille', () => {
    // ancre au centre (2000, 1500) : cloison à x = 1000, le grand morceau est à droite
    const big = planAfter(site([room], [cloison('c1', [1000, 0], [1000, 3000])]));
    const kept = big.rooms.find((r) => r.id === 'a')!;
    expect(roomArea(kept)).toBeGreaterThan(roomArea(big.rooms.find((r) => r.id !== 'a')!));
    // la cloison bouge sans franchir l’ancre : mêmes identifiants
    const moved = planAfter(site([room], [cloison('c1', [1300, 0], [1300, 3000])]));
    expect(moved.rooms.map((r) => r.id)).toEqual(big.rooms.map((r) => r.id));
    expect(moved.rooms.flatMap((r) => r.walls.map((w) => w.id))).toEqual(
      big.rooms.flatMap((r) => r.walls.map((w) => w.id)),
    );
  });

  it('un mur coupé garde son identifiant sur son premier morceau', () => {
    const plan = planAfter(site([room], [cloison('c1', [2000, 0], [2000, 3000])]));
    const ids = plan.rooms.flatMap((r) => r.walls.map((w) => w.id));
    expect(ids.filter((i) => i === 'a-w0')).toHaveLength(1);
    expect(ids).toContain('a-w0~2');
    expect(ids).toContain('c1:a');
    expect(ids).toContain('c1:b');
    const face = plan.rooms.flatMap((r) => r.walls).find((w) => w.id === 'c1:a')!;
    expect(face.thickness).toBe(72);
    expect(face.of).toEqual({ partition: 'c1', face: 'a' });
  });

  it('une porte donne une porte par face et un passage', () => {
    const q = cloison('c1', [2000, 0], [2000, 3000], {
      openings: [{ id: 'p', kind: 'door', offset: 1000, width: 830, height: 2040 }],
    });
    const plan = planAfter(site([room], [q]));
    expect(plan.rooms.flatMap((r) => r.openings.map((o) => o.id)).sort()).toEqual(['p:a', 'p:b']);
    expect(plan.passages.map((p) => p.id)).toEqual(['p:p']);
    expect(validatePlan(plan)).toEqual([]);
  });

  it('une cloison qui traverse un mur est ignorée et signalée', () => {
    const two = [rect('a', 3000, 3000), { ...rect('b', 3000, 3000), origin: [3072, 0] as [number, number] }];
    const s = site(two, [cloison('c1', [1500, 1500], [4500, 1500])]);
    const d = deriveSite(s);
    expect(d.issues.map((i) => i.code)).toContain('partition/crosses-wall');
    expect(d.plan).toBe(s.existing);
  });

  it('un mur verrouillé ne se traverse pas', () => {
    const base = rect('a', 3000, 3000);
    const locked = { ...base, walls: base.walls.map((w, i) => (i === 1 ? { ...w, locked: 'bearing' as const } : w)) };
    const b = { ...rect('b', 3000, 3000), origin: [3072, 0] as [number, number] };
    const d = deriveSite(site([locked, b], [cloison('c1', [1500, 1500], [4500, 1500])]));
    expect(d.issues.map((i) => i.code)).toContain('partition/crosses-locked');
  });

  it('retirer la cloison rétablit le plan', () => {
    const withC = site([room], [cloison('c1', [2000, 0], [2000, 3000])]);
    expect(planAfter({ ...withC, partitions: [] })).toBe(withC.existing);
  });

  it('déterminisme : l’ordre des cloisons ne change rien', () => {
    const c1 = cloison('c1', [1000, 0], [1000, 3000]);
    const c2 = cloison('c2', [3000, 0], [3000, 3000]);
    const x = planAfter(site([room], [c1, c2]));
    const y = planAfter(site([room], [c2, c1]));
    expect(y).toEqual(x);
    expect(x.rooms).toHaveLength(3);
  });

  it('les aires se conservent (propriété)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 300, max: 3700 }),
        fc.constantFrom(72, 98, 100),
        fc.constantFrom('center', 'left', 'right') as fc.Arbitrary<Partition['align']>,
        (x, t, align) => {
          const plan = planAfter(site([room], [cloison('c', [x, 0], [x, 3000], { thickness: t, align })]));
          expect(plan.rooms).toHaveLength(2);
          expect(Math.abs(total(plan) - (4000 * 3000 - t * 3000))).toBeLessThan(12e6 * 0.001);
          expect(validatePlan(plan)).toEqual([]);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('démolition', () => {
  const a = rect('a', 3000, 3000);
  const b = { ...rect('b', 3000, 3000), origin: [3072, 0] as [number, number] };

  it('fusionne deux pièces voisines', () => {
    const s = site([a, b], [], [{ id: 'd1', room: 'a', wall: 'a-w1', from: 0, to: 3000 }]);
    const plan = planAfter(s);
    expect(plan.rooms).toHaveLength(1);
    expect(plan.rooms[0]!.id).toBe('a');
    expect(total(plan)).toBeCloseTo(2 * 9e6 + 72 * 3000, -1);
    expect(validatePlan(plan)).toEqual([]);
    expect(deriveSite(s).issues).toEqual([]);
  });

  it('une démolition partielle laisse deux retours de mur', () => {
    const s = site([a, b], [], [{ id: 'd1', room: 'a', wall: 'a-w1', from: 1000, to: 2000 }]);
    const plan = planAfter(s);
    expect(plan.rooms).toHaveLength(1);
    const ids = plan.rooms[0]!.walls.map((w) => w.id);
    expect(ids).toContain('d1:1');
    expect(ids).toContain('d1:2');
    expect(validatePlan(plan)).toEqual([]);
  });

  it('refuse un mur verrouillé', () => {
    const locked = { ...a, walls: a.walls.map((w, i) => (i === 1 ? { ...w, locked: 'exterior' as const } : w)) };
    const s = site([locked, b], [], [{ id: 'd1', room: 'a', wall: 'a-w1', from: 0, to: 3000 }]);
    expect(deriveSite(s).issues.map((i) => i.code)).toEqual(['demolition/locked']);
    expect(planAfter(s)).toBe(s.existing);
  });

  it('refuse un mur sans pièce en face', () => {
    const s = site([a], [], [{ id: 'd1', room: 'a', wall: 'a-w1', from: 0, to: 3000 }]);
    expect(deriveSite(s).issues.map((i) => i.code)).toEqual(['demolition/no-neighbour']);
  });
});
