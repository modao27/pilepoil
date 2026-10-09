/**
 * Poses de carrelage continues (PLAN N2) : murs d'une même pièce qui se suivent, dépliés bout à bout avec un angle
 * à chaque jonction ; sols de pièces reliées par un passage, en une seule surface. Cas chiffrés et invariants.
 */
import { describe, expect, it } from 'vitest';
import type { Cut, SurfaceRef, Zone } from '../../src/core/coverage';
import { regionArea } from '../../src/core/geometry/boolean';
import type { Plan, PlanRoom } from '../../src/core/plan/types';
import { passageBand, wallDirection } from '../../src/core/plan/walls';
import { computeProject, edgeLengths, type ProjectSpec } from '../../src/modules/carrelage/core';
import { wallFrames } from '../../src/modules/carrelage/render/scene3d/placement';
import { createPoseSettings, createTile } from '../../src/modules/carrelage/state/factories';
import { wallHeightCuts } from '../../src/modules/carrelage/state/poses';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { roomShape } from '../../src/modules/carrelage/state/surfaces';
import type { Project } from '../../src/state/model';
import { planProject, rect, view, withOpening } from './planFixtures';

const tile = createTile({ length: 300, width: 300 });
const spec = (p: Project): ProjectSpec => toProjectSpec(view(p), [tile]).spec;
const wall = (room: string, i: number): SurfaceRef => ({ room, wall: `${room}-w${i}` });

/** Projet avec des poses de carrelage sur plusieurs zones : `poses[id] = zones (surface, lignes)`. */
function project(plan: Plan, poses: Record<string, { ref: SurfaceRef; cuts?: Cut[] }[]>): Project {
  const zones: Zone[] = Object.entries(poses).flatMap(([pose, zs]) =>
    zs.map((z, k) => ({ id: `${pose}-z${k}`, surface: z.ref, cuts: z.cuts ?? [], pose })),
  );
  return planProject(
    plan.rooms,
    { poses: Object.fromEntries(Object.keys(poses).map((id) => [id, createPoseSettings(tile.id)])) },
    {
      plan,
      zones,
      poses: Object.keys(poses).map((id) => ({ id, module: 'carrelage', name: id })),
    },
  );
}

/** Pièce 3 × 2 m, 2,5 m sous plafond, porte sur le mur 2 (à 50 cm de son début). */
const room = (): PlanRoom =>
  withOpening(rect('r', 3000, 2000, { height: 2500 }), 1, {
    kind: 'door',
    offset: 500,
    width: 800,
    sill: 0,
    height: 2000,
  });
const plan1 = (): Plan => ({ rooms: [room()], passages: [] });

describe('murs qui se suivent', () => {
  it('L de deux murs : une surface dépliée de 5 m, un angle rentrant à 3 m, porte décalée du premier mur', () => {
    const p = project(plan1(), { L: [{ ref: wall('r', 1) }, { ref: wall('r', 0) }] });
    const [s] = view(p).surfaces;
    expect(s).toMatchObject({
      name: 'Pièce, murs 1 et 2',
      kind: 'wall',
      width: 5000,
      height: 2500,
      outline: null,
      origin: [0, 0],
      corners: [{ x: 3000, type: 'in', angle: 90 }],
      parts: [
        { ref: wall('r', 0), x: 0, y: 0 },
        { ref: wall('r', 1), x: -3000, y: 0 },
      ],
    });
    expect(s!.openings).toMatchObject([{ source: 'plan', type: 'door', x: 3500, width: 800 }]);
    // moteur : angle reçu, aucun carreau à cheval sur l'angle
    const sp = spec(p);
    expect(sp.surfaces[0]!.corners).toEqual([{ x: 3000, type: 'in', angle: 90, covered: false }]);
    const r = computeProject(sp);
    expect(r.surfaces[0]!.ok).toBe(true);
    for (const pc of r.pieces) {
      const xs = (pc.parts ?? []).flat().map((q) => q[0]);
      if (xs.length) expect(Math.min(...xs) < 2999 && Math.max(...xs) > 3001).toBe(false);
    }
  });

  it('silicone et profilés : l’angle d’une pose continue compté une fois, comme avec deux poses', () => {
    const one = edgeLengths(spec(project(plan1(), { L: [{ ref: wall('r', 0) }, { ref: wall('r', 1) }] })));
    const two = edgeLengths(spec(project(plan1(), { A: [{ ref: wall('r', 0) }], B: [{ ref: wall('r', 1) }] })));
    expect(one).toEqual(two);
  });

  it('hauteur propre à chaque mur : contour en escalier, aire des deux zones', () => {
    const plan = plan1();
    const p = project(plan, {
      L: [{ ref: wall('r', 0), cuts: wallHeightCuts(plan, wall('r', 0), 1200) }, { ref: wall('r', 1) }],
    });
    const [s] = view(p).surfaces;
    expect([s!.width, s!.height]).toEqual([5000, 2500]);
    expect(s!.outline).not.toBeNull();
    expect(regionArea(s!.outline!)).toBeCloseTo(3000 * 1200 + 2000 * 2500, -1);
    expect(computeProject(spec(p)).surfaces[0]!.ok).toBe(true);
  });

  it('U de trois murs qui referme sur le mur 1 : chaîne 4 → 1 → 2, deux angles', () => {
    const p = project(plan1(), { U: [{ ref: wall('r', 1) }, { ref: wall('r', 3) }, { ref: wall('r', 0) }] });
    const [s] = view(p).surfaces;
    expect(s!.name).toBe('Pièce, murs 4, 1, 2');
    expect(s!.width).toBe(2000 + 3000 + 2000);
    expect(s!.corners.map((c) => c.x)).toEqual([2000, 5000]);
    expect(s!.parts.map((q) => q.ref.wall)).toEqual(['r-w3', 'r-w0', 'r-w1']);
  });

  it('3D : dessinée depuis son premier mur, repliée dans le sens des murs suivants', () => {
    const plan = plan1();
    const p = project(plan, { L: [{ ref: wall('r', 0) }, { ref: wall('r', 1) }] });
    const shape = roomShape(plan, view(p).surfaces, 'r')!;
    expect(shape.walls.map((w) => w && [w.surface, w.draw])).toEqual([[0, true], [0, false], null, null]);
    const r = plan.rooms[0]!;
    const frames = wallFrames(spec(p).surfaces[0]!, [0, 0], wallDirection(r, 0));
    expect(frames).toHaveLength(2);
    const d = wallDirection(r, 1);
    expect(frames[1]!.dir[0]).toBeCloseTo(d[0], 6);
    expect(frames[1]!.dir[1]).toBeCloseTo(d[1], 6);
  });
});

describe('sols reliés par un passage', () => {
  /** Séjour 4 × 3 m et bureau 3 × 3 m, mur de 72 mm, portes de 83 cm face à face (y de 1000 à 1830). */
  function twoRooms(): Plan {
    const a = withOpening(rect('a', 4000, 3000, { name: 'Séjour' }), 1, {
      id: 'da',
      kind: 'door',
      offset: 1000,
      width: 830,
      sill: 0,
      height: 2040,
    });
    const b = {
      ...withOpening(rect('b', 3000, 3000, { name: 'Bureau' }), 3, {
        id: 'db',
        kind: 'door',
        offset: 1170,
        width: 830,
        sill: 0,
        height: 2040,
      }),
      origin: [4072, 0] as [number, number],
    };
    return { rooms: [a, b], passages: [{ id: 'P', a: { room: 'a', opening: 'da' }, b: { room: 'b', opening: 'db' } }] };
  }

  it('bande du passage : baie de 83 cm sur l’épaisseur du mur, sens horaire', () => {
    const band = passageBand(twoRooms(), twoRooms().passages[0]!, 0)!;
    expect(band).toEqual([
      [4072, 1000],
      [4072, 1830],
      [4000, 1830],
      [4000, 1000],
    ]);
  });

  it('une seule surface : les deux sols et le passage, au repère du plan', () => {
    const plan = twoRooms();
    const p = project(plan, {
      S: [{ ref: { room: 'a', wall: null } }, { ref: { room: 'b', wall: null } }],
    });
    const [s] = view(p).surfaces;
    expect(s).toMatchObject({
      name: 'Séjour + Bureau, sol',
      kind: 'floor',
      width: 7072,
      height: 3000,
      origin: [0, 0],
      parts: [
        { ref: { room: 'a', wall: null }, x: 0, y: 0 },
        { ref: { room: 'b', wall: null }, x: -4072, y: 0 },
      ],
    });
    expect(regionArea(s!.outline!)).toBeCloseTo(12e6 + 9e6 + 830 * 72, -2);
    const r = computeProject(spec(p));
    expect(r.surfaces[0]!.ok).toBe(true);
    // un seul plan de découpe, la surface posée est celle des deux pièces et du passage
    const laid = r.pieces.reduce((t, pc) => t + (pc.parts ?? []).reduce((u, q) => u + regionArea([q]), 0), 0);
    expect(laid / 1e6).toBeGreaterThan(20.5);
    expect(laid / 1e6).toBeLessThan(21.1);
    // 3D : le sol posé dans chaque pièce à sa place
    expect(roomShape(plan, view(p).surfaces, 'b')!.floorOrigin).toEqual([-4072, 0]);
  });
});
