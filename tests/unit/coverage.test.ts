/** Zones et poses (docs/NAVIGATION.md §4, PLAN N1) : géométrie, règles, réducteur. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkZone,
  orphanZones,
  posesInRoom,
  reduceCoverage,
  removeRoom,
  roomsConnected,
  surfacePolygon,
  wallChain,
  wallRuns,
  roomGroups,
  zoneArea,
  zoneRegion,
  type Coverage,
  type CoverageRules,
  type Pose,
  type Zone,
} from '../../src/core/coverage';
import { intersection, regionArea } from '../../src/core/geometry/boolean';
import { rectPoly } from '../../src/core/geometry/polygon';
import type { Plan } from '../../src/core/plan/types';
import { rect } from './planFixtures';

const TILE: CoverageRules = { surfaces: ['floor', 'wall'], extent: 'surface' };
const WOOD: CoverageRules = { surfaces: ['floor'], extent: 'connected-floors' };
const rulesOf = (m: string) => (m === 'carrelage' ? TILE : m === 'parquet' ? WOOD : undefined);

// deux pièces 4 × 3 m côte à côte, une troisième isolée ; un passage entre a et b
const a = {
  ...rect('a', 4000, 3000, { height: 2500 }),
  obstacles: [{ id: 'p', kind: 'post' as const, outline: rectPoly(1000, 1000, 200, 200) }],
};
const b = { ...rect('b', 3000, 3000), origin: [4072, 0] as [number, number] };
const c = { ...rect('c', 2000, 2000), origin: [0, 5000] as [number, number] };
const plan: Plan = {
  rooms: [a, b, c],
  passages: [{ id: 'pa', a: { room: 'a', opening: 'o1' }, b: { room: 'b', opening: 'o2' } }],
};
const floor = (room: string) => ({ room, wall: null });
const zone = (id: string, surface: Zone['surface'], pose: string, cuts: Zone['cuts'] = []): Zone => ({
  id,
  surface,
  cuts,
  pose,
});
const pose = (id: string, module: string): Pose => ({ id, module, name: id });
const empty: Coverage = { zones: [], poses: [] };

describe('géométrie des zones', () => {
  it('sol : contour et obstacles en trous ; mur : longueur × hauteur, repère y vers le haut', () => {
    expect(regionArea(surfacePolygon(plan, floor('a'))!)).toBeCloseTo(4000 * 3000 - 200 * 200, 3);
    expect(surfacePolygon(plan, { room: 'a', wall: 'a-w1' })).toEqual([
      [
        [0, 0],
        [3000, 0],
        [3000, 2500],
        [0, 2500],
      ],
    ]);
    expect(surfacePolygon(plan, { room: 'a', wall: 'absent' })).toBeNull();
    expect(surfacePolygon(plan, floor('absente'))).toBeNull();
  });

  it('ligne de découpe : côté de la normale (−dy, dx) × side', () => {
    // sol, ligne horizontale à y = 1000 vers +x : côté 1 = y > 1000 (bas de l'écran)
    const line: [[number, number], [number, number]] = [
      [0, 1000],
      [4000, 1000],
    ];
    expect(zoneArea(plan, zone('z', floor('a'), 'p', [{ line, side: 1 }]))).toBeCloseTo(4000 * 2000 - 40000, 3);
    expect(zoneArea(plan, zone('z', floor('a'), 'p', [{ line, side: -1 }]))).toBeCloseTo(4000 * 1000, 3);
    // crédence de 90 à 150 cm sur le mur 1 (4 m)
    const wall = { room: 'a', wall: 'a-w0' };
    const credence = zone('c', wall, 'p', [
      {
        line: [
          [0, 900],
          [4000, 900],
        ],
        side: 1,
      },
      {
        line: [
          [0, 1500],
          [4000, 1500],
        ],
        side: -1,
      },
    ]);
    expect(zoneArea(plan, credence)).toBeCloseTo(4000 * 600, 3);
  });
});

describe('règles', () => {
  const cov: Coverage = { zones: [zone('z1', floor('a'), 'p1')], poses: [pose('p1', 'carrelage')] };

  it('recouvrement refusé sur une même surface, contact accepté', () => {
    const left = zone('z1', floor('a'), 'p1', [
      {
        line: [
          [2000, 0],
          [2000, 3000],
        ],
        side: 1,
      },
    ]);
    const half: Coverage = { zones: [left], poses: [pose('p1', 'carrelage'), pose('p2', 'parquet')] };
    const right = zone('z2', floor('a'), 'p2', [
      {
        line: [
          [2000, 0],
          [2000, 3000],
        ],
        side: -1,
      },
    ]);
    expect(checkZone(plan, half, right, WOOD)).toBeNull();
    expect(checkZone(plan, half, zone('z3', floor('a'), 'p2'), WOOD)).toEqual({ code: 'zone-overlap', zone: 'z1' });
  });

  it('surface absente, refusée par le module, zone vide', () => {
    expect(checkZone(plan, cov, zone('w', { room: 'a', wall: 'x' }, 'p1'), TILE)).toEqual({ code: 'surface-missing' });
    expect(checkZone(plan, empty, zone('w', { room: 'a', wall: 'a-w0' }, 'p1'), WOOD)).toEqual({
      code: 'surface-unsupported',
    });
    const nothing = zone('n', floor('b'), 'p1', [
      {
        line: [
          [0, 1000],
          [3000, 1000],
        ],
        side: 1,
      },
      {
        line: [
          [0, 500],
          [3000, 500],
        ],
        side: -1,
      },
    ]);
    expect(checkZone(plan, empty, nothing, TILE)).toEqual({ code: 'zone-empty' });
  });

  it('pose : pas de mélange sol et mur ; carrelage sur une surface ; parquet sur des pièces reliées', () => {
    expect(checkZone(plan, cov, zone('w', { room: 'a', wall: 'a-w0' }, 'p1'), TILE)).toEqual({ code: 'pose-mixed' });
    expect(checkZone(plan, cov, zone('f', floor('b'), 'p1'), TILE)).toEqual({ code: 'pose-extent' });
    const wood: Coverage = { zones: [zone('z1', floor('a'), 'w')], poses: [pose('w', 'parquet')] };
    expect(checkZone(plan, wood, zone('f', floor('b'), 'w'), WOOD)).toBeNull();
    expect(checkZone(plan, wood, zone('f', floor('c'), 'w'), WOOD)).toEqual({ code: 'pose-extent' });
    expect(roomsConnected(plan, ['a', 'b', 'c'])).toBe(false);
    expect(roomsConnected(plan, ['b', 'a'])).toBe(true);
  });

  it('pose continue : sols reliés, ou murs d’une même pièce qui se suivent', () => {
    const CONT: CoverageRules = { surfaces: ['floor', 'wall'], extent: 'continuous' };
    const wall = (room: string, i: number) => ({ room, wall: `${room}-w${i}` });
    const walls = (ids: number[]): Coverage => ({
      zones: ids.map((i) => zone(`z${i}`, wall('a', i), 'p')),
      poses: [pose('p', 'carrelage')],
    });
    // mur 2 à côté du mur 1 : oui ; mur 3 après un trou : non ; mur 4 qui referme sur le mur 1 : oui
    expect(checkZone(plan, walls([0]), zone('n', wall('a', 1), 'p'), CONT)).toBeNull();
    expect(checkZone(plan, walls([0]), zone('n', wall('a', 2), 'p'), CONT)).toEqual({ code: 'pose-extent' });
    expect(checkZone(plan, walls([0]), zone('n', wall('a', 3), 'p'), CONT)).toBeNull();
    // mur d'une autre pièce : non ; deux zones sur un même mur (crédence coupée) : oui
    expect(checkZone(plan, walls([0]), zone('n', wall('b', 0), 'p'), CONT)).toEqual({ code: 'pose-extent' });
    const high = zone('n', wall('a', 0), 'p', [
      {
        line: [
          [0, 1500],
          [4000, 1500],
        ],
        side: 1,
      },
    ]);
    const low = {
      ...walls([0]),
      zones: [
        zone('z0', wall('a', 0), 'p', [
          {
            line: [
              [0, 1500],
              [4000, 1500],
            ],
            side: -1,
          },
        ]),
      ],
    };
    expect(checkZone(plan, low, high, CONT)).toBeNull();
    // sols : comme le parquet
    const floors: Coverage = { zones: [zone('f', floor('a'), 'p')], poses: [pose('p', 'carrelage')] };
    expect(checkZone(plan, floors, zone('n', floor('b'), 'p'), CONT)).toBeNull();
    expect(checkZone(plan, floors, zone('n', floor('c'), 'p'), CONT)).toEqual({ code: 'pose-extent' });
  });

  it('chaîne de murs : ordre du contour, tour complet, trou refusé', () => {
    expect(wallChain(a, ['a-w3', 'a-w0'])).toEqual(['a-w3', 'a-w0']);
    expect(wallChain(a, ['a-w2', 'a-w1', 'a-w1'])).toEqual(['a-w1', 'a-w2']);
    expect(wallChain(a, ['a-w0', 'a-w1', 'a-w2', 'a-w3'])).toEqual(['a-w0', 'a-w1', 'a-w2', 'a-w3']);
    expect(wallChain(a, ['a-w0', 'a-w2'])).toBeNull();
    expect(wallChain(a, ['x'])).toBeNull();
  });

  it('suites de murs et groupes de pièces reliées (séparer une pose qui ne se suit plus)', () => {
    expect(wallRuns(a, ['a-w0', 'a-w2'])).toEqual([['a-w0'], ['a-w2']]);
    expect(wallRuns(a, ['a-w3', 'a-w0', 'a-w2'])).toEqual([['a-w2', 'a-w3', 'a-w0']]);
    expect(wallRuns(a, ['a-w0', 'a-w1', 'a-w2', 'a-w3'])).toEqual([['a-w0', 'a-w1', 'a-w2', 'a-w3']]);
    expect(roomGroups(plan, ['c', 'b', 'a'])).toEqual([['a', 'b'], ['c']]);
  });

  it('propriété : un arc du contour est une chaîne, un arc privé d’un mur intérieur ne l’est pas', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 12 }), fc.nat(), fc.nat(), (n, s, l) => {
        const room = {
          ...rect('r', 1000, 1000),
          walls: Array.from({ length: n }, (_, i) => ({ id: `w${i}`, thickness: 100 })),
        };
        const len = 1 + (l % n);
        const arc = Array.from({ length: len }, (_, k) => `w${(s + k) % n}`);
        const chain = wallChain(room, [...arc].reverse());
        expect(chain).toEqual(len === n ? room.walls.map((w) => w.id) : arc);
        if (len >= 3 && len < n)
          expect(
            wallChain(
              room,
              arc.filter((_, k) => k !== 1),
            ),
          ).toBeNull();
      }),
    );
  });
});

describe('réducteur', () => {
  it('nouvelle pose, coupe en deux poses, suppression d’une zone puis de la pose vide', () => {
    let cov = reduceCoverage(
      plan,
      empty,
      { type: 'pose/add', pose: pose('p1', 'carrelage'), zones: [zone('z1', floor('a'), 'p1')], settings: {} },
      rulesOf,
    );
    expect(cov.poses.map((p) => p.id)).toEqual(['p1']);
    const line: [[number, number], [number, number]] = [
      [2000, 0],
      [2000, 3000],
    ];
    cov = reduceCoverage(
      plan,
      cov,
      { type: 'zone/cut', zoneId: 'z1', line, newZoneId: 'z2', pose: { pose: pose('p2', 'parquet'), settings: {} } },
      rulesOf,
    );
    expect(cov.zones.map((z) => [z.id, z.pose])).toEqual([
      ['z1', 'p1'],
      ['z2', 'p2'],
    ]);
    expect(zoneArea(plan, cov.zones[0]!) + zoneArea(plan, cov.zones[1]!)).toBeCloseTo(4000 * 3000 - 40000, 0);
    cov = reduceCoverage(plan, cov, { type: 'zone/remove', zoneId: 'z2' }, rulesOf);
    expect(cov.poses.map((p) => p.id)).toEqual(['p1']);
  });

  it('action qui enfreint une règle ou sans effet : même référence', () => {
    const cov = reduceCoverage(
      plan,
      empty,
      { type: 'pose/add', pose: pose('p1', 'carrelage'), zones: [zone('z1', floor('a'), 'p1')], settings: {} },
      rulesOf,
    );
    expect(reduceCoverage(plan, cov, { type: 'zone/add', zone: zone('z2', floor('a'), 'p1') }, rulesOf)).toBe(cov);
    expect(reduceCoverage(plan, cov, { type: 'pose/rename', poseId: 'p1', name: ' p1 ' }, rulesOf)).toBe(cov);
    expect(reduceCoverage(plan, cov, { type: 'zone/prune' }, rulesOf)).toBe(cov);
    expect(
      reduceCoverage(
        plan,
        cov,
        {
          type: 'pose/add',
          pose: pose('p2', 'parquet'),
          zones: [zone('w', { room: 'a', wall: 'a-w0' }, 'p2')],
          settings: {},
        },
        rulesOf,
      ),
    ).toBe(cov);
  });

  it('pièce supprimée, zones orphelines', () => {
    const cov: Coverage = {
      zones: [zone('z1', floor('a'), 'w'), zone('z2', floor('b'), 'w'), zone('z3', { room: 'a', wall: 'gone' }, 't')],
      poses: [pose('w', 'parquet'), pose('t', 'carrelage')],
    };
    expect(posesInRoom(cov, 'a').map((p) => p.id)).toEqual(['w', 't']);
    expect(removeRoom(cov, 'a')).toEqual({ zones: [cov.zones[1]], poses: [cov.poses[0]] });
    expect(orphanZones(plan, cov.zones).map((z) => z.id)).toEqual(['z3']);
    expect(reduceCoverage(plan, cov, { type: 'zone/prune' }, rulesOf).poses.map((p) => p.id)).toEqual(['w']);
  });

  it('propriété : une coupe donne deux zones qui redonnent la zone, sans se recouvrir', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 4500 }),
        fc.integer({ min: -500, max: 3500 }),
        fc.integer({ min: 0, max: 359 }),
        (x, y, deg) => {
          const t = (deg * Math.PI) / 180;
          const line: [[number, number], [number, number]] = [
            [x, y],
            [x + Math.cos(t) * 1000, y + Math.sin(t) * 1000],
          ];
          const whole = zone('z', floor('a'), 'p');
          const one = zoneRegion(plan, { ...whole, cuts: [{ line, side: 1 }] })!;
          const two = zoneRegion(plan, { ...whole, cuts: [{ line, side: -1 }] })!;
          // arrondi des booléens au 1/100 mm : quelques mm² sur 12 m²
          expect(Math.abs(regionArea(one) + regionArea(two) - zoneArea(plan, whole))).toBeLessThan(50);
          expect(regionArea(intersection(one, two))).toBeLessThan(100);
        },
      ),
      { numRuns: 60 },
    );
  });
});
