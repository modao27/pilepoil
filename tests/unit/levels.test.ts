/** Niveaux de sol et hauteurs propres des murs (T1, étape 1) : modèle et invariants. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { passageStep, roomFloor, sameLevel, STEP_MIN, wallHeight, wallHeightOf } from '../../src/core/plan/levels';
import { reducePlan } from '../../src/core/plan/reduce';
import type { Passage, Plan } from '../../src/core/plan/types';
import { validatePlan } from '../../src/core/plan/validate';
import { rect } from './planFixtures';

const a = rect('a', 4000, 3000, { height: 2500 });
const b = rect('b', 3000, 3000, { height: 2500 });
const passage: Passage = { id: 'p', a: { room: 'a', opening: 'oa' }, b: { room: 'b', opening: 'ob' } };
const plan: Plan = { rooms: [a, b], passages: [passage] };
const withFloor = (roomId: string, floor: number) =>
  reducePlan(plan, { type: 'plan/room/update', roomId, patch: { floor } });

describe('niveaux de sol', () => {
  it('sans niveau : sol à 0, aucune marche, murs à la hauteur de la pièce (comme avant)', () => {
    expect(roomFloor(a)).toBe(0);
    expect(passageStep(plan, passage)).toBe(0);
    for (const [i, w] of a.walls.entries()) {
      expect(wallHeight(a, w), String(i)).toBe(2500);
      expect(wallHeightOf(a, w.id)).toBe(2500);
    }
    expect(validatePlan({ rooms: [a], passages: [] })).toEqual([]);
  });

  it('la marche est le niveau de B moins celui de A, signée', () => {
    expect(passageStep(withFloor('b', -150), passage)).toBe(-150);
    expect(passageStep(withFloor('a', 200), passage)).toBe(-200);
    expect(passageStep(withFloor('b', 80), passage)).toBe(80);
  });

  it('sous 5 mm : pas de marche, sol continu', () => {
    expect(STEP_MIN).toBe(5);
    expect(passageStep(withFloor('b', 4), passage)).toBe(0);
    expect(passageStep(withFloor('b', -4.9), passage)).toBe(0);
    expect(passageStep(withFloor('b', 5), passage)).toBe(5);
    expect(sameLevel({ floor: 0 }, { floor: 4 })).toBe(true);
    expect(sameLevel({ floor: 0 }, { floor: 5 })).toBe(false);
    expect(sameLevel({}, {})).toBe(true);
  });

  it('un passage vers une pièce absente n’a pas de marche', () => {
    expect(passageStep(plan, { a: { room: 'a', opening: 'x' }, b: { room: 'zz', opening: 'y' } })).toBe(0);
  });

  it('mettre à jour le niveau d’une pièce ne touche rien d’autre, et rien si la valeur est la même', () => {
    const q = withFloor('b', -150);
    expect(q.rooms[0]).toBe(a);
    expect(q.rooms[1]).toEqual({ ...b, floor: -150 });
    expect(reducePlan(q, { type: 'plan/room/update', roomId: 'b', patch: { floor: -150 } })).toBe(q);
  });

  it('propriété : la marche est antisymétrique (échanger A et B change son signe)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 500 }), fc.integer({ min: -500, max: 500 }), (fa, fb) => {
        const p = {
          rooms: [
            { ...a, floor: fa },
            { ...b, floor: fb },
          ],
          passages: [passage],
        };
        const swapped = { a: passage.b, b: passage.a };
        expect(passageStep(p, swapped)).toBe(-passageStep(p, passage) || 0);
      }),
    );
  });
});

describe('hauteur propre d’un mur', () => {
  it('une hauteur valable est gardée, sinon celle de la pièce', () => {
    const wall = a.walls[0]!;
    expect(wallHeight(a, { ...wall, height: 900 })).toBe(900);
    expect(wallHeight(a, { ...wall, height: 2500 })).toBe(2500);
    expect(wallHeight(a, { ...wall, height: 3000 })).toBe(2500);
    expect(wallHeight(a, { ...wall, height: 0 })).toBe(2500);
    expect(wallHeight(a, { ...wall, height: -10 })).toBe(2500);
  });

  it('validation : niveau et hauteurs incohérents sont signalés, le reste non', () => {
    const wall = a.walls[1]!;
    const bad = (patch: object) => ({ ...a, walls: a.walls.map((w) => (w.id === wall.id ? { ...w, ...patch } : w)) });
    expect(validatePlan({ rooms: [bad({ height: 900 })], passages: [] })).toEqual([]);
    expect(validatePlan({ rooms: [bad({ height: 3000 })], passages: [] })).toEqual([
      { code: 'wall/height', room: 'a', id: wall.id },
    ]);
    expect(validatePlan({ rooms: [bad({ height: 0 })], passages: [] }).map((e) => e.code)).toEqual(['wall/height']);
    expect(validatePlan({ rooms: [{ ...a, floor: -150 }], passages: [] })).toEqual([]);
    expect(validatePlan({ rooms: [{ ...a, floor: Number.NaN }], passages: [] }).map((e) => e.code)).toEqual([
      'room/floor',
    ]);
  });
});
