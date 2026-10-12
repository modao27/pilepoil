/** Pièces voisines (PLAN N3) : murs en vis-à-vis, pièce posée contre un mur, porte et passage en une action. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { lRoom, rectRoom } from '../../src/core/plan/factories';
import { doorBetween, facingWalls, placeAgainst } from '../../src/core/plan/neighbors';
import { reducePlan, type PlanAction } from '../../src/core/plan/reduce';
import type { Plan } from '../../src/core/plan/types';
import { passageError, validatePlan } from '../../src/core/plan/validate';
import { passageBand } from '../../src/core/plan/walls';
import { ids } from './planFixtures';

const seq = (p: string) => ids(p);
const apply = (plan: Plan, actions: PlanAction[]) => actions.reduce(reducePlan, plan);

/** Séjour 4 × 3 m à l'origine, puis une pièce `w × h` posée contre son mur 2 (droite). */
function pair(w = 3000, h = 3000, thickness = 72): Plan {
  const a = rectRoom(4000, 3000, { name: 'Séjour', thickness }, seq('a'));
  const plan: Plan = { rooms: [a], passages: [] };
  const b = rectRoom(w, h, { name: 'Bureau', thickness }, seq('b'));
  const origin = placeAgainst(plan, { room: a.id, wall: a.walls[1]!.id }, b.outline)!;
  return { ...plan, rooms: [a, { ...b, origin }] };
}

describe('pièce contre un mur', () => {
  it('contre le mur droit du séjour : de l’autre côté de la cloison, alignée sur le début du mur', () => {
    const plan = pair();
    expect(plan.rooms[1]!.origin).toEqual([4072, 0]);
    expect(validatePlan(plan)).toEqual([]);
    // contre le mur du haut (vers la droite) : la pièce passe au-dessus, son bord gauche au début du mur
    const a = plan.rooms[0]!;
    expect(
      placeAgainst(plan, { room: a.id, wall: a.walls[0]!.id }, rectRoom(2000, 1500, { name: 'P' }, seq('c')).outline),
    ).toEqual([0, -1572]);
  });

  it('mur en biais : aucun mur de la nouvelle pièce dans ce sens, pas de placement', () => {
    const tri = {
      ...rectRoom(1000, 1000, { name: 'P' }, seq('t')),
      outline: [
        [0, 0],
        [1000, 0],
        [0, 1000],
      ] as [number, number][],
    };
    tri.walls = tri.walls.slice(0, 3);
    const plan: Plan = { rooms: [tri], passages: [] };
    expect(
      placeAgainst(
        plan,
        { room: tri.id, wall: tri.walls[1]!.id },
        rectRoom(1000, 1000, { name: 'P' }, seq('x')).outline,
      ),
    ).toBeNull();
  });
});

describe('murs en vis-à-vis', () => {
  it('séjour et bureau : un seul mur commun, sur toute la hauteur du bureau', () => {
    const plan = pair(3000, 2000);
    const [a, b] = plan.rooms;
    expect(facingWalls(plan)).toEqual([
      { a: { room: a!.id, wall: a!.walls[1]!.id }, b: { room: b!.id, wall: b!.walls[3]!.id }, from: 0, to: 2000 },
    ]);
    expect(facingWalls(plan, b!.id)).toHaveLength(1);
    // pièces éloignées : rien
    const far = { ...plan, rooms: [a!, { ...b!, origin: [6000, 0] as [number, number] }] };
    expect(facingWalls(far)).toEqual([]);
  });

  it('cloison plus épaisse que l’écart : rien ; écart égal à l’épaisseur (à 1 cm) : vis-à-vis', () => {
    const plan = pair(3000, 3000, 100);
    expect(plan.rooms[1]!.origin).toEqual([4100, 0]);
    expect(facingWalls(plan)).toHaveLength(1);
    const moved = { ...plan, rooms: [plan.rooms[0]!, { ...plan.rooms[1]!, origin: [4130, 0] as [number, number] }] };
    expect(facingWalls(moved)).toEqual([]);
  });
});

describe('porte vers la pièce voisine', () => {
  it('deux portes face à face au milieu du mur commun, passage valide, bande sous la porte', () => {
    const plan = pair();
    const actions = doorBetween(plan, facingWalls(plan)[0]!, seq('d'))!;
    const next = apply(plan, actions);
    const [a, b] = next.rooms;
    expect(a!.openings[0]).toMatchObject({ kind: 'door', offset: 1085, width: 830, sill: 0 });
    expect(b!.openings[0]).toMatchObject({ kind: 'door', offset: 1085, width: 830 });
    const p = next.passages[0]!;
    expect(passageError(next, p.a, p.b)).toBeNull();
    expect(validatePlan(next)).toEqual([]);
    expect(passageBand(next, p, 0)).toEqual([
      [4072, 1085],
      [4072, 1915],
      [4000, 1915],
      [4000, 1085],
    ]);
  });

  it('partie commune trop étroite pour la porte : refusé', () => {
    const plan = pair(1000, 600);
    expect(doorBetween(plan, facingWalls(plan)[0]!, seq('d'))).toBeNull();
  });

  it('propriété : toute pièce posée contre un mur peut recevoir une porte valide vers ce mur', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 900, max: 6000 }),
        fc.integer({ min: 900, max: 6000 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 50, max: 300 }),
        (w, h, k, t) => {
          const a = lRoom(5000, 4000, 2000, 1500, { name: 'P', thickness: t }, seq('a'));
          const plan: Plan = { rooms: [a], passages: [] };
          const b = rectRoom(w, h, { name: 'P', thickness: t }, seq('b'));
          const wall = a.walls[k]!;
          const origin = placeAgainst(plan, { room: a.id, wall: wall.id }, b.outline);
          if (!origin) return;
          const two: Plan = { ...plan, rooms: [a, { ...b, origin }] };
          const f = facingWalls(two).find((x) => x.a.wall === wall.id);
          expect(f).toBeDefined();
          const actions = doorBetween(two, f!, seq('d'));
          if (!actions) return;
          const next = apply(two, actions);
          const p = next.passages[0]!;
          expect(passageError(next, p.a, p.b)).toBeNull();
        },
      ),
    );
  });
});
