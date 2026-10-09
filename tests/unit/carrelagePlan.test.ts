/**
 * Carrelage bâti sur le plan (PLAN C2) : un sol et un mur du plan se calculent sans ressaisie de cotes,
 * modifier le plan met le carrelage à jour, joints entre surfaces, avertissements du plan.
 */
import { describe, expect, it } from 'vitest';
import { area, pointInPolygon, rectPoly, signedArea } from '../../src/core/geometry/polygon';
import type { PlanAction } from '../../src/core/plan/reduce';
import { module as carrelage } from '../../src/modules/carrelage';
import { computeProject, type ProjectSpec } from '../../src/modules/carrelage/core';
import {
  createFloorTiling,
  createReservation,
  createRoomTiling,
  createTile,
  createWallTiling,
} from '../../src/modules/carrelage/state/factories';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { parseSurfaceId, planWarnings, roomCorners, surfaceId } from '../../src/modules/carrelage/state/surfaces';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';
import { lShape, planProject, rect, view, withOpening } from './planFixtures';

const tile = createTile({ length: 300, width: 300 });
const spec = (p: Project): ProjectSpec => toProjectSpec(view(p), [tile]).spec;

/** Sol en L 4 m × 3 m (coin de 1,5 m × 1 m retiré) avec un poteau de 20 cm. */
function lFloor(): Project {
  const room = {
    ...lShape('r', 4000, 3000, 1500, 1000),
    obstacles: [{ id: 'post', kind: 'post' as const, outline: rectPoly(1000, 1000, 200, 200) }],
  };
  return planProject([room], { rooms: { r: createRoomTiling({ floor: createFloorTiling(tile.id) }) } });
}

/** Mur 1 (4 m) d'une pièce de 2,5 m de haut, avec une porte et une fenêtre du plan et une prise. */
function doorWall(o: { tiledHeight?: number | null } = {}): Project {
  let room = rect('r', 4000, 3000, { height: 2500 });
  room = withOpening(room, 0, { kind: 'door', offset: 300, width: 830, sill: 0, height: 2040 });
  room = withOpening(room, 0, { kind: 'window', offset: 2000, width: 1000, sill: 1000, height: 1000 });
  const wall = createWallTiling(tile.id, {
    tiledHeight: o.tiledHeight ?? null,
    reservations: [createReservation('socket', { x: 3500, sill: 300 })],
    openings: {
      'r-o1': { covered: false, revealDepth: 120, reveals: { left: true, right: true, top: true, bottom: true } },
    },
  });
  return planProject([room], { rooms: { r: createRoomTiling({ walls: { 'r-w0': wall } }) } });
}

describe('identifiants de surface', () => {
  it('aller-retour, y compris avec des identifiants du plan qui contiennent « : »', () => {
    for (const ref of [
      { room: 'r', wall: null },
      { room: 'p:plan:0', wall: 'p:plan:3' },
    ])
      expect(parseSurfaceId(surfaceId(ref))).toEqual(ref);
    expect(parseSurfaceId('sans-séparateur')).toBeNull();
  });
});

describe('sol d’une pièce du plan', () => {
  it('contour et poteau repris du plan : boîte englobante, trou d’aire négative', () => {
    const s = view(lFloor()).surfaces[0]!;
    expect(s).toMatchObject({ id: 'r~floor', kind: 'floor', width: 4000, height: 3000, name: 'Pièce, sol' });
    expect(s.outline).toHaveLength(2);
    expect(signedArea(s.outline![0]!)).toBeGreaterThan(0);
    expect(signedArea(s.outline![1]!)).toBeLessThan(0);
    expect(area(s.outline![0]!) - area(s.outline![1]!)).toBeCloseTo(4000 * 3000 - 1500 * 1000 - 200 * 200, 6);
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

  it('hauteur carrelée bornée par la hauteur de la pièce', () => {
    expect(spec(doorWall({ tiledHeight: 1200 })).surfaces[0]!.height).toBe(1200);
    expect(spec(doorWall({ tiledHeight: 9000 })).surfaces[0]!.height).toBe(2500);
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
    const walls = { 'r-w0': createWallTiling(tile.id), 'r-w1': createWallTiling(tile.id, { tiledHeight: 1200 }) };
    const p = planProject([room], { rooms: { r: createRoomTiling({ floor: createFloorTiling(tile.id), walls }) } });
    const sp = spec(p);
    expect(sp.rooms).toEqual([
      { walls: [1, 2, null, null], corners: ['in', 'in', 'in', 'in'], outerCovered: true, floor: 0, perimeter: 7000 },
    ]);
    // silicone : angle mur 1 / mur 2 (1,2 m) + pied des murs (7 m)
    const silicone = computeProject(sp).shopping.find((it) => it.kind === 'silicone');
    expect(silicone).toMatchObject({ meters: 1.2 + 7 });
  });
});

describe('avertissements du plan', () => {
  it('mur disparu du plan : signalé, retiré par « prune », plus calculé', () => {
    const p = doorWall();
    const q = reduceProject(p, { type: 'plan/point/remove', roomId: 'r', index: 0 });
    // le point 0 retiré : le mur 4 (r-w3) absorbe le mur 1 (r-w0), qui disparaît
    expect(planWarnings(q.plan, view(q).rooms)).toEqual([{ code: 'wall-missing', room: 'r', wall: 'r-w0' }]);
    expect(view(q).surfaces).toEqual([]);
    expect(carrelage.toSpec(q, { tiles: [tile] })).toEqual({ errors: [{ code: 'carrelage/empty' }] });
    const pruned = reduceProject(q, { type: 'carrelage/prune' } as never);
    expect(view(pruned).rooms).toEqual({});
  });

  it('pièce supprimée du plan : ses réglages carrelage partent avec elle', () => {
    const p = lFloor();
    const q = reduceProject(p, { type: 'plan/room/remove', roomId: 'r' });
    expect(view(q).rooms).toEqual({});
  });
});
