import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  alignForPassage,
  emptyPlan,
  lRoom,
  rectRoom,
  reducePlan,
  uRoom,
  validatePlan,
  validateRoom,
  wallLength,
  type Plan,
  type PlanAction,
  type PlanRoom,
  type WallOpening,
} from '../../src/core/plan';

/** Identifiants déterministes. */
function ids(prefix = 'id') {
  let n = 0;
  return () => `${prefix}${++n}`;
}

const planOf = (...rooms: PlanRoom[]): Plan => ({ rooms, passages: [] });
const door = (wall: string, offset: number, id = 'd1', width = 830): WallOpening => ({
  id,
  kind: 'door',
  wall,
  offset,
  width,
  sill: 0,
  height: 2040,
});
const room = (p: Plan, i = 0) => p.rooms[i]!;
const lengths = (r: PlanRoom) => r.walls.map((_, i) => Math.round(wallLength(r, i) * 1000) / 1000);

describe('pièces types', () => {
  it('rectangle, L et U valides, murs de 72 mm', () => {
    const id = ids();
    for (const r of [
      rectRoom(4000, 3000, { name: 'A' }, id),
      lRoom(6000, 5000, 3000, 2000, { name: 'B' }, id),
      uRoom(6000, 5000, 1500, 2000, { name: 'C' }, id),
    ]) {
      expect(validateRoom(r)).toEqual([]);
      expect(r.walls).toHaveLength(r.outline.length);
      expect(r.walls.every((w) => w.thickness === 72)).toBe(true);
    }
    expect(lengths(lRoom(6000, 5000, 3000, 2000, { name: 'B' }, id))).toEqual([6000, 3000, 3000, 2000, 3000, 5000]);
  });
});

describe('validation', () => {
  const r = () => rectRoom(4000, 3000, { name: 'A' }, ids());

  it('contour : trop peu de points, croisé, sens antihoraire', () => {
    const base = r();
    expect(validateRoom({ ...base, outline: base.outline.slice(0, 2), walls: base.walls.slice(0, 2) })).toEqual([
      { code: 'room/too-few-points', room: base.id },
    ]);
    const crossed = {
      ...base,
      outline: [
        [0, 0],
        [4000, 3000],
        [4000, 0],
        [0, 3000],
      ] as PlanRoom['outline'],
    };
    expect(validateRoom(crossed).map((e) => e.code)).toEqual(['room/self-intersecting']);
    expect(validateRoom({ ...base, outline: [...base.outline].reverse() }).map((e) => e.code)).toEqual(['room/area']);
    expect(validateRoom({ ...base, walls: base.walls.slice(1) }).map((e) => e.code)).toEqual(['room/walls-count']);
  });

  it('murs, obstacles, ouvertures', () => {
    const base = r();
    const w = base.walls;
    const bad: PlanRoom = {
      ...base,
      walls: [{ ...w[0]!, thickness: 0 }, ...w.slice(1)],
      obstacles: [
        {
          id: 'o1',
          kind: 'post',
          outline: [
            [3900, 100],
            [4100, 100],
            [4100, 300],
          ],
        },
      ],
      openings: [
        door(w[0]!.id, 3500, 'd1'),
        door(w[1]!.id, 100, 'd2'),
        door(w[1]!.id, 500, 'd3'),
        door('nope', 0, 'd4'),
        { ...door(w[2]!.id, 0, 'd5'), width: 0 },
      ],
    };
    expect(validateRoom(bad).map((e) => [e.code, e.id])).toEqual([
      ['wall/thickness', w[0]!.id],
      ['obstacle/outside', 'o1'],
      ['opening/outside-wall', 'd1'],
      ['opening/overlap', 'd3'],
      ['opening/wall-missing', 'd4'],
      ['opening/size', 'd5'],
    ]);
  });
});

describe('réducteur du plan', () => {
  it('ajout et suppression de pièce, passages retirés avec elle', () => {
    const id = ids();
    const a = rectRoom(4000, 3000, { name: 'A' }, id);
    let p = reducePlan(emptyPlan(), { type: 'plan/room/add', room: a });
    p = reducePlan(p, { type: 'plan/room/add', room: rectRoom(3000, 3000, { name: 'B' }, id) });
    p = reducePlan(p, {
      type: 'plan/passage/add',
      passage: { id: 'p1', a: { room: a.id, opening: 'x' }, b: { room: room(p, 1).id, opening: 'y' } },
    });
    const removed = reducePlan(p, { type: 'plan/room/remove', roomId: a.id });
    expect(removed.rooms.map((r) => r.name)).toEqual(['B']);
    expect(removed.passages).toEqual([]);
  });

  it('rien ne change : même objet (pas d’étape d’historique)', () => {
    const p = planOf(rectRoom(4000, 3000, { name: 'A' }, ids()));
    const r = room(p);
    const same: PlanAction[] = [
      { type: 'plan/room/update', roomId: r.id, patch: { name: 'A' } },
      { type: 'plan/room/update', roomId: 'inconnue', patch: { name: 'B' } },
      { type: 'plan/point/move', roomId: r.id, index: 1, point: [4000, 0] },
      { type: 'plan/point/remove', roomId: r.id, index: 9 },
      { type: 'plan/wall/length', roomId: r.id, wallId: r.walls[0]!.id, length: 4000 },
      { type: 'plan/wall/length', roomId: r.id, wallId: r.walls[0]!.id, length: -5 },
      { type: 'plan/wall/update', roomId: r.id, wallId: r.walls[0]!.id, patch: { thickness: 72 } },
      { type: 'plan/opening/remove', roomId: r.id, openingId: 'x' },
      { type: 'plan/passage/remove', passageId: 'x' },
    ];
    for (const a of same) expect(reducePlan(p, a)).toBe(p);
  });

  it('ajouter un point coupe le mur ; les ouvertures suivent leur moitié', () => {
    const p0 = planOf(rectRoom(4000, 3000, { name: 'A' }, ids()));
    const r0 = room(p0);
    const top = r0.walls[0]!.id;
    const withDoors = reducePlan(
      reducePlan(p0, { type: 'plan/opening/add', roomId: r0.id, opening: door(top, 200, 'd1', 800) }),
      { type: 'plan/opening/add', roomId: r0.id, opening: door(top, 2600, 'd2', 800) },
    );
    const p = reducePlan(withDoors, {
      type: 'plan/point/insert',
      roomId: r0.id,
      wallId: top,
      point: [1500, 0],
      newWallId: 'w-new',
    });
    const r = room(p);
    expect(r.outline[1]).toEqual([1500, 0]);
    expect(r.walls.map((w) => w.id)).toEqual([top, 'w-new', ...r0.walls.slice(1).map((w) => w.id)]);
    expect(lengths(r)).toEqual([1500, 2500, 3000, 4000, 3000]);
    expect(r.openings).toEqual([door(top, 200, 'd1', 800), door('w-new', 1100, 'd2', 800)]);
    expect(validatePlan(p)).toEqual([]);
  });

  it('retirer un point fusionne deux murs ; le premier garde son id, les ouvertures sont reportées', () => {
    const id = ids();
    const r0 = lRoom(6000, 5000, 3000, 2000, { name: 'L' }, id);
    const p0 = reducePlan(planOf(r0), {
      type: 'plan/opening/add',
      roomId: r0.id,
      opening: door(r0.walls[1]!.id, 1000, 'd1', 800),
    });
    // point 1 (6000, 0) : murs 0 et 1 fusionnent
    const r = room(reducePlan(p0, { type: 'plan/point/remove', roomId: r0.id, index: 1 }));
    expect(r.outline).toHaveLength(5);
    expect(r.walls.map((w) => w.id)).toEqual([r0.walls[0]!.id, ...r0.walls.slice(2).map((w) => w.id)]);
    expect(r.openings[0]).toMatchObject({ wall: r0.walls[0]!.id, offset: 7000 });
    // point 0 : le mur qui y arrive (dernier) absorbe le mur 0
    const r2 = room(reducePlan(p0, { type: 'plan/point/remove', roomId: r0.id, index: 0 }));
    expect(r2.walls.map((w) => w.id)).toEqual([...r0.walls.slice(1).map((w) => w.id)]);
    expect(r2.outline[0]).toEqual([6000, 0]);
  });

  it('cote d’un mur : le rectangle reste un rectangle, le L reste un L', () => {
    const rect = rectRoom(4000, 3000, { name: 'A' }, ids());
    const set = (r: PlanRoom, i: number, length: number) =>
      room(reducePlan(planOf(r), { type: 'plan/wall/length', roomId: r.id, wallId: r.walls[i]!.id, length }));
    expect(lengths(set(rect, 0, 5000))).toEqual([5000, 3000, 5000, 3000]);
    expect(lengths(set(rect, 1, 2000))).toEqual([4000, 2000, 4000, 2000]);
    expect(lengths(set(rect, 3, 3500))).toEqual([4000, 3500, 4000, 3500]);
    const l = lRoom(6000, 5000, 3000, 2000, { name: 'L' }, ids());
    expect(lengths(set(l, 0, 7000))).toEqual([7000, 3000, 4000, 2000, 3000, 5000]);
    expect(lengths(set(l, 1, 4000))).toEqual([6000, 4000, 3000, 1000, 3000, 5000]);
    expect(validateRoom(set(l, 1, 4000))).toEqual([]);
  });

  it('obstacles et ouvertures : ajout, modification, suppression ; un passage part avec sa porte', () => {
    const id = ids();
    const a = rectRoom(4000, 3000, { name: 'A' }, id);
    const b = rectRoom(3000, 3000, { name: 'B', origin: [4072, 0] }, id);
    let p = planOf(a, b);
    p = reducePlan(p, { type: 'plan/opening/add', roomId: a.id, opening: door(a.walls[1]!.id, 1000, 'da') });
    p = reducePlan(p, { type: 'plan/opening/add', roomId: b.id, opening: door(b.walls[3]!.id, 1170, 'db') });
    p = reducePlan(p, {
      type: 'plan/passage/add',
      passage: { id: 'p1', a: { room: a.id, opening: 'da' }, b: { room: b.id, opening: 'db' } },
    });
    expect(validatePlan(p)).toEqual([]);
    p = reducePlan(p, { type: 'plan/opening/update', roomId: a.id, openingId: 'da', patch: { width: 900 } });
    expect(validatePlan(p)).toEqual([{ code: 'passage/width', id: 'p1' }]);
    p = reducePlan(p, {
      type: 'plan/obstacle/add',
      roomId: a.id,
      obstacle: {
        id: 'post',
        kind: 'post',
        outline: [
          [100, 100],
          [300, 100],
          [300, 300],
          [100, 300],
        ],
      },
    });
    p = reducePlan(p, { type: 'plan/obstacle/update', roomId: a.id, obstacleId: 'post', patch: { kind: 'duct' } });
    expect(room(p).obstacles[0]!.kind).toBe('duct');
    p = reducePlan(p, { type: 'plan/opening/remove', roomId: a.id, openingId: 'da' });
    expect(p.passages).toEqual([]);
    p = reducePlan(p, { type: 'plan/obstacle/remove', roomId: a.id, obstacleId: 'post' });
    expect(room(p).obstacles).toEqual([]);
  });
});

describe('passages', () => {
  it('aligne la seconde pièce : portes face à face, à l’épaisseur du mur', () => {
    const id = ids();
    const a = rectRoom(4000, 3000, { name: 'A' }, id);
    const b = rectRoom(3000, 2500, { name: 'B', origin: [9000, 7000] }, id);
    const p = planOf(
      { ...a, openings: [door(a.walls[1]!.id, 1000, 'da')] },
      { ...b, openings: [door(b.walls[3]!.id, 300, 'db')] },
    );
    const refs = [
      { room: a.id, opening: 'da' },
      { room: b.id, opening: 'db' },
    ] as const;
    const r = alignForPassage(p, refs[0], refs[1]);
    // mur droit de A (x = 4000), mur gauche de B à 72 mm ; centres de porte alignés (y = 1415)
    expect(r).toEqual({ origin: [4072, 1415 - (2500 - 300 - 415)] });
    if (!('origin' in r)) return;
    const moved = reducePlan(p, { type: 'plan/room/update', roomId: b.id, patch: { origin: r.origin } });
    const linked = reducePlan(moved, { type: 'plan/passage/add', passage: { id: 'p1', a: refs[0], b: refs[1] } });
    expect(validatePlan(linked)).toEqual([]);
  });

  it('refuse des portes de largeurs différentes, ou sur des murs non parallèles', () => {
    const id = ids();
    const a = rectRoom(4000, 3000, { name: 'A' }, id);
    const b = rectRoom(3000, 3000, { name: 'B' }, id);
    const p = planOf(
      { ...a, openings: [door(a.walls[1]!.id, 1000, 'da')] },
      { ...b, openings: [door(b.walls[0]!.id, 300, 'db'), door(b.walls[3]!.id, 300, 'dc', 700)] },
    );
    expect(alignForPassage(p, { room: a.id, opening: 'da' }, { room: b.id, opening: 'db' })).toEqual({
      error: 'passage/not-facing',
    });
    expect(alignForPassage(p, { room: a.id, opening: 'da' }, { room: b.id, opening: 'dc' })).toEqual({
      error: 'passage/width',
    });
    expect(alignForPassage(p, { room: a.id, opening: 'da' }, { room: a.id, opening: 'da' })).toEqual({
      error: 'passage/missing',
    });
  });
});

describe('propriétés', () => {
  /** Rectangle entier, une porte entière par mur du haut. */
  const rectArb = fc
    .record({ l: fc.integer({ min: 1000, max: 9000 }), w: fc.integer({ min: 1000, max: 9000 }) })
    .map(({ l, w }) => {
      const r = rectRoom(l, w, { name: 'R' }, ids('w'));
      return { ...r, openings: [door(r.walls[0]!.id, 100, 'd1', 600)] };
    });

  it('ajouter puis retirer un point sur un mur redonne la même pièce', () => {
    fc.assert(
      fc.property(
        rectArb,
        fc.integer({ min: 0, max: 3 }),
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        (r, i, t) => {
          const [a, b] = [r.outline[i]!, r.outline[(i + 1) % 4]!];
          // point entier sur le mur : arithmétique exacte
          const pt: [number, number] = [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)];
          const p = planOf(r);
          const ins = reducePlan(p, {
            type: 'plan/point/insert',
            roomId: r.id,
            wallId: r.walls[i]!.id,
            point: pt,
            newWallId: 'nouveau',
          });
          const back = reducePlan(ins, { type: 'plan/point/remove', roomId: r.id, index: i + 1 });
          expect(back).toEqual(p);
        },
      ),
    );
  });

  it('suite d’ajouts et de retraits : un mur par segment, ids stables et uniques, ouvertures sur un mur existant', () => {
    const op = fc.oneof(
      fc.record({
        kind: fc.constant('insert' as const),
        wall: fc.nat(),
        t: fc.double({ min: 0.1, max: 0.9, noNaN: true }),
      }),
      fc.record({ kind: fc.constant('remove' as const), index: fc.nat() }),
    );
    fc.assert(
      fc.property(rectArb, fc.array(op, { maxLength: 20 }), (r0, ops) => {
        let p = planOf(r0);
        let n = 0;
        for (const o of ops) {
          const r = room(p);
          const before = new Set(r.walls.map((w) => w.id));
          if (o.kind === 'insert') {
            const i = o.wall % r.walls.length;
            const [a, b] = [r.outline[i]!, r.outline[(i + 1) % r.outline.length]!];
            const pt: [number, number] = [a[0] + (b[0] - a[0]) * o.t, a[1] + (b[1] - a[1]) * o.t];
            p = reducePlan(p, {
              type: 'plan/point/insert',
              roomId: r.id,
              wallId: r.walls[i]!.id,
              point: pt,
              newWallId: `n${++n}`,
            });
          } else {
            p = reducePlan(p, { type: 'plan/point/remove', roomId: r.id, index: o.index % r.outline.length });
          }
          const next = room(p);
          expect(next.walls).toHaveLength(next.outline.length);
          expect(next.outline.length).toBeGreaterThanOrEqual(3);
          const after = next.walls.map((w) => w.id);
          expect(new Set(after).size).toBe(after.length);
          // au plus un mur disparaît, au plus un apparaît
          expect(
            after.filter((x) => !before.has(x)).length + [...before].filter((x) => !after.includes(x)).length,
          ).toBeLessThanOrEqual(1);
          for (const op of next.openings) expect(after).toContain(op.wall);
        }
      }),
    );
  });

  it('cote d’un mur d’un rectangle : toujours un rectangle valide', () => {
    fc.assert(
      fc.property(rectArb, fc.integer({ min: 0, max: 3 }), fc.integer({ min: 500, max: 12000 }), (r, i, len) => {
        const next = room(
          reducePlan(planOf(r), { type: 'plan/wall/length', roomId: r.id, wallId: r.walls[i]!.id, length: len }),
        );
        const l = lengths(next);
        expect(l[i]).toBe(len);
        expect(l[(i + 2) % 4]).toBe(len);
        expect(l[(i + 1) % 4]).toBe(lengths(r)[(i + 1) % 4]);
        expect(validateRoom({ ...next, openings: [] })).toEqual([]);
      }),
    );
  });
});
