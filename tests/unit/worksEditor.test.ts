/** Aides de l'éditeur de travaux : aimantation, revêtements perdus, 3D d'une cloison neuve. */
import { describe, expect, it } from 'vitest';
import { lostByPose } from '../../src/core/coverage';
import { planAfter } from '../../src/core/plan/derive';
import { snapPartitionPoint, snapToFaces } from '../../src/core/plan/snap';
import type { Partition, Plan } from '../../src/core/plan/types';
import { buildEnvelope } from '../../src/render/scene3d/envelope';
import { rect } from './planFixtures';

const plan: Plan = { rooms: [rect('a', 4000, 3000)], passages: [] };
const cloison = (thickness: number): Partition => ({
  id: 'c',
  a: [2000, 0],
  b: [2000, 3000],
  thickness,
  align: 'center',
  openings: [],
});

describe('aimantation des cloisons', () => {
  it('une arête proche : le point se pose sur la face du mur', () => {
    expect(snapToFaces([1500, 6], plan, 12)).toEqual([1500, 0]);
    expect(snapToFaces([1500, 40], plan, 12)).toBeNull();
  });

  it('un sommet l’emporte sur l’arête', () => {
    expect(snapToFaces([5, 5], plan, 12)).toEqual([0, 0]);
  });

  it('angle droit avec le départ, puis arrêt sur la face du mur d’en face', () => {
    // départ au milieu du mur du haut ; point d’arrivée à peu près en dessous, près du mur du bas
    const end = snapPartitionPoint([2004, 2990], [2000, 0], plan, 12);
    expect(end).toEqual([2000, 3000]);
  });

  it('loin de tout : grille de 1 cm', () => {
    expect(snapPartitionPoint([1234.4, 1500.2], null, plan, 12)).toEqual([1230, 1500]);
  });
});

describe('revêtements perdus', () => {
  const zone = { id: 'z', surface: { room: 'a', wall: null }, cuts: [], pose: 'P' };
  const pose = { id: 'P', module: 'carrelage', name: 'Pose 1' };

  it('une cloison rogne le sol : la perte est la surface de la cloison', () => {
    const after = planAfter({ existing: plan, partitions: [cloison(72)], demolitions: [] });
    const loss = lostByPose(plan, after, [zone], [pose]);
    expect(loss).toHaveLength(1);
    expect(loss[0]!.pose).toBe(pose);
    // la zone reste sur la pièce gardée seulement : moitié droite (ancre au centre, tombée dans la cloison)
    expect(loss[0]!.area).toBeGreaterThan(5e6);
  });

  it('rien de perdu sans travaux ni quand les surfaces ne changent pas', () => {
    expect(lostByPose(plan, plan, [zone], [pose])).toEqual([]);
  });
});

describe('3D : une cloison neuve est un mur de ses deux pièces', () => {
  it.each([72, 98, 100])('épaisseur %i mm : le plâtre est dessiné de chaque côté', (t) => {
    const after = planAfter({ existing: plan, partitions: [cloison(t)], demolitions: [] });
    const meshes = buildEnvelope(
      after,
      after.rooms.map((r) => r.id),
    );
    const plaster = meshes.find((m) => m.key === 'plaster')!;
    expect(plaster.positions.length).toBeGreaterThan(0);
    // la cloison occupe de x = 2000 − t / 2 à 2000 + t / 2 : des sommets des deux faces, en mètres
    const xs = new Set<number>();
    for (let i = 0; i < plaster.positions.length; i += 3) xs.add(Math.round(plaster.positions[i]! * 10000) / 10000);
    expect(xs.has(2 - t / 2000)).toBe(true);
    expect(xs.has(2 + t / 2000)).toBe(true);
  });
});
