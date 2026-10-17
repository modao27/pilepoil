/** Une partie seulement d'un mur : largeur et hauteur (PLAN N1). */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { wallAreaCuts, wallSpanCuts, zoneArea, zoneBox } from '../../src/core/coverage';
import type { Zone } from '../../src/core/coverage';
import { rect } from './planFixtures';

const room = rect('a', 4000, 3000, { height: 2500 });
const plan = { rooms: [room], passages: [] };
const surface = { room: 'a', wall: room.walls[0]!.id };
const zone = (cuts: Zone['cuts']): Zone => ({ id: 'z', surface, cuts, pose: 'p' });
const box = (cuts: Zone['cuts']) => zoneBox(plan, zone(cuts));

describe('zone d’un mur : largeur et hauteur', () => {
  it('mur entier : aucune coupe', () => {
    expect(wallAreaCuts(plan, surface, {})).toEqual([]);
    expect(wallAreaCuts(plan, surface, { x0: 0, x1: 4000, y0: 0, y1: 2500 })).toEqual([]);
    expect(box([])).toEqual([0, 4000, 0, 2500]);
  });

  it('une largeur seule : de 500 à 2 500 mm depuis le bord gauche', () => {
    expect(box(wallAreaCuts(plan, surface, { x0: 500, x1: 2500 }))).toEqual([500, 2500, 0, 2500]);
    expect(box(wallAreaCuts(plan, surface, { x0: 1000 }))).toEqual([1000, 4000, 0, 2500]);
    expect(box(wallAreaCuts(plan, surface, { x1: 1200 }))).toEqual([0, 1200, 0, 2500]);
  });

  it('largeur et hauteur ensemble : un rectangle', () => {
    const cuts = wallAreaCuts(plan, surface, { x0: 500, x1: 2500, y0: 300, y1: 1200 });
    expect(box(cuts)).toEqual([500, 2500, 300, 1200]);
    expect(zoneArea(plan, zone(cuts))).toBeCloseTo(2000 * 900, 3);
  });

  it('la hauteur seule reste celle de wallSpanCuts', () => {
    expect(wallAreaCuts(plan, surface, { y0: 300, y1: 1200 })).toEqual(wallSpanCuts(plan, surface, 300, 1200));
  });

  it('propriété : la surface est largeur × hauteur, pour tout rectangle dans le mur', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3800 }),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 0, max: 2300 }),
        fc.integer({ min: 100, max: 2500 }),
        (x0, w, y0, h) => {
          const x1 = Math.min(4000, x0 + w),
            y1 = Math.min(2500, y0 + h);
          const cuts = wallAreaCuts(plan, surface, { x0, x1, y0, y1 });
          expect(zoneArea(plan, zone(cuts))).toBeCloseTo((x1 - x0) * (y1 - y0), 0);
        },
      ),
    );
  });
});
