/** Équipements fixes du plan (PLAN N5) : taille usuelle, sol dessous, trous dans le sol revêtu. */
import { describe, expect, it } from 'vitest';
import { zoneArea, type Zone } from '../../src/core/coverage';
import { EQUIPMENT, EQUIPMENT_KINDS, floorHoles, floorUnder } from '../../src/core/plan/equipment';
import type { Obstacle, Plan } from '../../src/core/plan/types';
import { rect } from './planFixtures';

const sq = (x: number, y: number, w: number, h: number): Obstacle['outline'] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const obstacle = (id: string, kind: Obstacle['kind'], o: Partial<Obstacle> = {}): Obstacle => ({
  id,
  kind,
  outline: sq(100, 100, EQUIPMENT[kind].width, EQUIPMENT[kind].depth),
  ...o,
});
const floorArea = (obstacles: Obstacle[]) => {
  const room = { ...rect('a', 3000, 2400), obstacles };
  const plan: Plan = { rooms: [room], passages: [] };
  const z: Zone = { id: 'z', surface: { room: 'a', wall: null }, cuts: [], pose: 'p' };
  return zoneArea(plan, z);
};

describe('équipements du plan', () => {
  it('chaque type a un nom et un encombrement usuel', () => {
    for (const [kind, info] of Object.entries(EQUIPMENT)) {
      expect(info.label, kind).not.toBe('');
      expect(info.width, kind).toBeGreaterThan(0);
      expect(info.depth, kind).toBeGreaterThan(0);
    }
    expect(EQUIPMENT_KINDS).toEqual(['toilet', 'basin', 'shower', 'bath', 'sink', 'washer']);
    expect(EQUIPMENT.shower).toMatchObject({ width: 900, depth: 900 });
  });

  it('le sol passe sous un WC, un lavabo ou un lave-linge, pas sous un receveur ni une baignoire', () => {
    expect(floorUnder({ kind: 'toilet' })).toBe(true);
    expect(floorUnder({ kind: 'basin' })).toBe(true);
    expect(floorUnder({ kind: 'washer' })).toBe(true);
    expect(floorUnder({ kind: 'shower' })).toBe(false);
    expect(floorUnder({ kind: 'bath' })).toBe(false);
    expect(floorUnder({ kind: 'post' })).toBe(false);
  });

  it('le choix de l’utilisateur l’emporte sur l’usage du type', () => {
    expect(floorUnder({ kind: 'toilet', floorUnder: false })).toBe(false);
    expect(floorUnder({ kind: 'shower', floorUnder: true })).toBe(true);
  });

  it('seuls les éléments sans sol dessous trouent le sol revêtu', () => {
    const room = {
      obstacles: [obstacle('w', 'toilet'), obstacle('s', 'shower', { outline: sq(1000, 100, 900, 900) })],
    };
    expect(floorHoles(room).map((o) => o.id)).toEqual(['s']);
  });

  it('surface du sol : un receveur est déduit, un WC non, et le choix inverse change le résultat', () => {
    const full = 3000 * 2400;
    expect(floorArea([])).toBeCloseTo(full, 0);
    expect(floorArea([obstacle('s', 'shower')])).toBeCloseTo(full - 900 * 900, 0);
    expect(floorArea([obstacle('w', 'toilet')])).toBeCloseTo(full, 0);
    expect(floorArea([obstacle('w', 'toilet', { floorUnder: false })])).toBeCloseTo(full - 400 * 700, 0);
    expect(floorArea([obstacle('s', 'shower', { floorUnder: true })])).toBeCloseTo(full, 0);
  });
});
