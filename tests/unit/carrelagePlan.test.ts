/**
 * Carrelage bâti sur le plan et ses zones (PLAN C2, N1) : un sol et un mur du plan se calculent sans ressaisie de
 * cotes, une zone coupée (crédence, sol partagé) aussi ; modifier le plan met le carrelage à jour ; joints entre
 * surfaces ; zones orphelines.
 */
import { describe, expect, it } from 'vitest';
import { orphanZones } from '../../src/core/coverage';
import { area, pointInPolygon, rectPoly, signedArea } from '../../src/core/geometry/polygon';
import type { PlanAction } from '../../src/core/plan/reduce';
import { module as carrelage } from '../../src/modules/carrelage';
import { computeProject, type ProjectSpec } from '../../src/modules/carrelage/core';
import { createPoseSettings, createReservation, createTile } from '../../src/modules/carrelage/state/factories';
import { restoreTiling, wallHeightCuts } from '../../src/modules/carrelage/state/poses';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { roomCorners } from '../../src/modules/carrelage/state/surfaces';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';
import { lShape, rect, tiledProject, tilePose, view, withOpening } from './planFixtures';

const tile = createTile({ length: 300, width: 300 });
const spec = (p: Project): ProjectSpec => toProjectSpec(view(p), [tile]).spec;
const floorOf = (room: string) => ({ room, wall: null });
const wallOf = (room: string, wall: string) => ({ room, wall });

/** Sol en L 4 m × 3 m (coin de 1,5 m × 1 m retiré) avec un poteau de 20 cm. */
function lFloor(): Project {
  const room = {
    ...lShape('r', 4000, 3000, 1500, 1000),
    obstacles: [{ id: 'post', kind: 'post' as const, outline: rectPoly(1000, 1000, 200, 200) }],
  };
  return tiledProject([room], [tilePose('F', floorOf('r'), createPoseSettings(tile.id))]);
}

/** Mur 1 (4 m) d'une pièce de 2,5 m de haut, porte et fenêtre du plan, une prise ; zone coupée par `cuts`. */
function doorWall(o: { height?: number | null; cuts?: Parameters<typeof tilePose>[3] } = {}): Project {
  let room = rect('r', 4000, 3000, { height: 2500 });
  room = withOpening(room, 0, { kind: 'door', offset: 300, width: 830, sill: 0, height: 2040 });
  room = withOpening(room, 0, { kind: 'window', offset: 2000, width: 1000, sill: 1000, height: 1000 });
  const settings = createPoseSettings(tile.id, {
    reservations: [createReservation('socket', wallOf('r', 'r-w0'), { x: 3500, sill: 300 })],
    openings: {
      'r-o1': { covered: false, revealDepth: 120, reveals: { left: true, right: true, top: true, bottom: true } },
    },
  });
  const plan = { rooms: [room], passages: [] };
  const cuts = o.height !== undefined ? wallHeightCuts(plan, wallOf('r', 'r-w0'), o.height) : undefined;
  return tiledProject([room], [tilePose('W', wallOf('r', 'r-w0'), settings, { cuts, ...o.cuts })]);
}

describe('sol d’une pièce du plan', () => {
  it('contour et poteau repris du plan : boîte englobante, trou d’aire négative', () => {
    const s = view(lFloor()).surfaces[0]!;
    expect(s).toMatchObject({ id: 'F', kind: 'floor', width: 4000, height: 3000, name: 'Pièce, sol' });
    expect(s.outline).toHaveLength(2);
    expect(signedArea(s.outline![0]!)).toBeGreaterThan(0);
    expect(signedArea(s.outline![1]!)).toBeLessThan(0);
    expect(area(s.outline![0]!) - area(s.outline![1]!)).toBeCloseTo(4000 * 3000 - 1500 * 1000 - 200 * 200, 0);
  });

  it('se calcule sans ressaisie : rien dans le coin retiré ni dans le poteau', () => {
    const r = computeProject(spec(lFloor()));
    expect(r.surfaces[0]!.ok).toBe(true);
    const posed = r.pieces.flatMap((p) => p.parts ?? []);
    const inPost = posed.filter((poly) => poly.every((q) => pointInPolygon(q, rectPoly(1001, 1001, 198, 198))));
    expect(inPost).toEqual([]);
    const cut: [number, number] = [3500, 2800];
    expect(posed.some((poly) => pointInPolygon(cut, poly))).toBe(false);
    const posedArea = posed.reduce((t, poly) => t + area(poly), 0);
    expect(posedArea).toBeLessThanOrEqual(4000 * 3000 - 1500 * 1000 - 200 * 200 + 1);
    expect(posedArea).toBeGreaterThan(0.95 * (4000 * 3000 - 1500 * 1000 - 200 * 200));
  });

  it('modifier le plan met le sol à jour', () => {
    const p = lFloor();
    const before = computeProject(spec(p)).metrics.order;
    const move: PlanAction = { type: 'plan/point/move', roomId: 'r', index: 1, point: [5000, 0] };
    const q = reduceProject(p, move);
    // le point 2 ne suit pas : le mur 2 devient biais, le sol s'agrandit
    expect(view(q).surfaces[0]!.width).toBe(5000);
    expect(computeProject(spec(q)).metrics.order).toBeGreaterThan(before);
  });

  it('sol partagé par une ligne : deux poses, chacune sur sa partie, noms distincts', () => {
    const room = rect('r', 4000, 3000);
    const line: [[number, number], [number, number]] = [
      [2000, 0],
      [2000, 3000],
    ];
    const p = tiledProject(
      [room],
      [
        tilePose('A', floorOf('r'), createPoseSettings(tile.id), { cuts: [{ line, side: -1 }], name: 'Pose 1' }),
        tilePose('B', floorOf('r'), createPoseSettings(tile.id), { cuts: [{ line, side: 1 }], name: 'Pose 2' }),
      ],
    );
    const [a, b] = view(p).surfaces;
    expect([a!.name, a!.width, a!.origin[0], b!.name, b!.width, b!.origin[0]]).toEqual([
      'Pièce, sol · Pose 1',
      2000,
      2000,
      'Pièce, sol · Pose 2',
      2000,
      0,
    ]);
    expect(computeProject(spec(p)).surfaces.every((s) => s.ok)).toBe(true);
  });
});

describe('mur d’une pièce du plan', () => {
  it('longueur du mur × hauteur de la pièce ; portes et fenêtres du plan puis réservations', () => {
    const s = spec(doorWall()).surfaces[0]!;
    expect(s).toMatchObject({ kind: 'wall', width: 4000, height: 2500, corners: [] });
    expect(s.outline).toBeUndefined();
    expect(s.openings.map((o) => [o.type, o.x, o.sill, o.width, o.height])).toEqual([
      ['door', 300, 0, 830, 2040],
      ['window', 2000, 1000, 1000, 1000],
      ['socket', 3500, 300, 80, 80],
    ]);
    // finitions : par défaut pour la porte, saisies pour la fenêtre
    expect(s.openings[0]).toMatchObject({ covered: true, revealDepth: 0 });
    expect(s.openings[1]).toMatchObject({ covered: false, revealDepth: 120, reveals: { B: true } });
    expect(computeProject(spec(doorWall())).surfaces[0]!.ok).toBe(true);
  });

  it('hauteur carrelée : ligne haute de la zone, bornée par la hauteur de la pièce', () => {
    expect(spec(doorWall({ height: 1200 })).surfaces[0]!.height).toBe(1200);
    expect(spec(doorWall({ height: 9000 })).surfaces[0]!.height).toBe(2500);
  });

  it('crédence de 90 à 150 cm : surface de 60 cm, ouvertures et réservations recalées sur la zone', () => {
    const cuts = [
      {
        line: [
          [0, 900],
          [4000, 900],
        ] as [[number, number], [number, number]],
        side: 1 as const,
      },
      {
        line: [
          [0, 1500],
          [4000, 1500],
        ] as [[number, number], [number, number]],
        side: -1 as const,
      },
    ];
    const v = view(doorWall({ cuts: { cuts } }));
    const s = v.surfaces[0]!;
    expect([s.width, s.height, s.origin]).toEqual([4000, 600, [0, 900]]);
    // fenêtre du plan : allège 100 cm depuis le sol → 10 cm au-dessus du bas de la crédence
    expect(s.openings.find((o) => o.type === 'window')).toMatchObject({ x: 2000, sill: 100 });
    expect(s.openings.find((o) => o.type === 'socket')).toMatchObject({ x: 3500, sill: -600 });
    expect(computeProject(spec(doorWall({ cuts: { cuts } }))).surfaces[0]!.ok).toBe(true);
  });

  it('modifier le plan met le mur à jour : hauteur, position d’une fenêtre', () => {
    let p = doorWall();
    p = reduceProject(p, { type: 'plan/room/update', roomId: 'r', patch: { height: 2700 } });
    p = reduceProject(p, { type: 'plan/opening/update', roomId: 'r', openingId: 'r-o1', patch: { offset: 2500 } });
    const s = spec(p).surfaces[0]!;
    expect(s.height).toBe(2700);
    expect(s.openings[1]!.x).toBe(2500);
  });
});

describe('joints entre surfaces d’une pièce', () => {
  it('angle sortant au point rentrant d’une pièce en L', () => {
    expect(roomCorners(lShape('r', 4000, 3000, 1500, 1000))).toEqual(['in', 'in', 'in', 'out', 'in', 'in']);
    expect(roomCorners(rect('r', 4000, 3000))).toEqual(['in', 'in', 'in', 'in']);
  });

  it('pièce : surface de chaque mur carrelé, sol, pourtour des murs carrelés', () => {
    const room = rect('r', 4000, 3000, { height: 2500 });
    const plan = { rooms: [room], passages: [] };
    const p = tiledProject(
      [room],
      [
        tilePose('F', floorOf('r'), createPoseSettings(tile.id)),
        tilePose('W0', wallOf('r', 'r-w0'), createPoseSettings(tile.id)),
        tilePose('W1', wallOf('r', 'r-w1'), createPoseSettings(tile.id), {
          cuts: wallHeightCuts(plan, wallOf('r', 'r-w1'), 1200),
        }),
      ],
    );
    const sp = spec(p);
    expect(sp.rooms).toEqual([
      { walls: [1, 2, null, null], corners: ['in', 'in', 'in', 'in'], outerCovered: true, floor: 0, perimeter: 7000 },
    ]);
    // silicone : angle mur 1 / mur 2 (1,2 m) + pied des murs (7 m)
    const silicone = computeProject(sp).shopping.find((it) => it.kind === 'silicone');
    expect(silicone).toMatchObject({ meters: 1.2 + 7 });
  });
});

describe('plan modifié, scénarios', () => {
  it('mur disparu du plan : zone signalée, plus calculée, retirée par « zone/prune » avec sa pose', () => {
    const p = doorWall();
    const q = reduceProject(p, { type: 'plan/point/remove', roomId: 'r', index: 0 });
    // le point 0 retiré : le mur 4 (r-w3) absorbe le mur 1 (r-w0), qui disparaît
    expect(orphanZones(q.plan, q.zones).map((z) => z.id)).toEqual(['W-z']);
    expect(view(q).surfaces).toEqual([]);
    expect(carrelage.toSpec(q, { tiles: [tile] })).toEqual({ errors: [{ code: 'carrelage/empty' }] });
    const pruned = reduceProject(q, { type: 'zone/prune' });
    expect([pruned.zones, pruned.poses, view(pruned).poses]).toEqual([[], [], {}]);
  });

  it('pièce supprimée du plan : ses poses et leurs réglages partent avec elle', () => {
    const q = reduceProject(lFloor(), { type: 'plan/room/remove', roomId: 'r' });
    expect([q.zones, q.poses, view(q).poses]).toEqual([[], [], {}]);
  });

  it('scénario : le carrelage figé revient, les autres revêtements restent ; recouvrement refusé', () => {
    const snap = lFloor();
    const now = {
      ...lFloor(),
      zones: [],
      poses: [],
      modules: { carrelage: { schemaVersion: 3, data: { ...view(snap), poses: {} } } },
    };
    const back = restoreTiling(now as Project, snap);
    expect('code' in back).toBe(false);
    expect((back as Project).poses.map((p) => p.id)).toEqual(['F']);
    // un parquet a été posé depuis sur ce sol : le scénario ne peut plus revenir
    const wood = {
      ...now,
      zones: [{ id: 'w', surface: floorOf('r'), cuts: [], pose: 'P' }],
      poses: [{ id: 'P', module: 'parquet', name: 'Parquet' }],
    };
    expect(restoreTiling(wood as Project, snap)).toEqual({ code: 'zone-overlap', zone: 'w' });
  });
});
