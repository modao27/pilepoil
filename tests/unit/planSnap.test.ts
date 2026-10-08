import { describe, expect, it } from 'vitest';
import { area } from '../../src/core/geometry/polygon';
import { lRoom, rectRoom } from '../../src/core/plan/factories';
import { clockwise, labelPoint, placeNewRoom, planBounds, snapPoint } from '../../src/core/plan/snap';
import { wallBands } from '../../src/core/plan/walls';

let n = 0;
const id = () => 'i' + ++n;

describe('aimantation', () => {
  it('grille de 10 mm, sinon axe d’un voisin (angle droit)', () => {
    expect(snapPoint([1234, 567], [], 50)).toEqual([1230, 570]);
    expect(snapPoint([1234, 567], [[1200, 0]], 50)).toEqual([1200, 570]);
    expect(snapPoint([1234, 567], [[0, 590]], 50)).toEqual([1230, 590]);
    expect(snapPoint([1234, 567], [[1300, 700]], 50)).toEqual([1230, 570]);
    // le voisin le plus proche l'emporte
    expect(
      snapPoint(
        [1234, 0],
        [
          [1260, 9999],
          [1240, 9999],
        ],
        50,
      ),
    ).toEqual([1240, 0]);
  });

  it('nouvelle pièce : à droite des autres, alignée en haut', () => {
    const plan = { rooms: [rectRoom(4000, 3000, { name: 'A', origin: [100, 200] }, id)], passages: [] };
    expect(planBounds(plan)).toEqual([100, 4100, 200, 3200]);
    expect(placeNewRoom(plan)).toEqual([5100, 200]);
    expect(placeNewRoom({ rooms: [], passages: [] })).toEqual([0, 0]);
  });

  it('sens horaire à l’écran', () => {
    const cw: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(clockwise(cw)).toBe(cw);
    expect(clockwise([...cw].reverse())).toEqual(cw);
  });
});

describe('tracé des murs', () => {
  it('bandes vers l’extérieur, aire = périmètre × épaisseur + angles', () => {
    const r = rectRoom(4000, 3000, { name: 'A' }, id);
    const bands = wallBands(r);
    expect(bands).toHaveLength(4);
    expect(bands[0]).toEqual([
      [0, 0],
      [4000, 0],
      [4072, -72],
      [-72, -72],
    ]);
    const total = bands.reduce((s, b) => s + area(b), 0);
    expect(total).toBeCloseTo((4072 * 2 + 3072 * 2) * 72 - 0, 0);
  });

  it('pièce en L : angle rentrant en onglet', () => {
    const r = lRoom(6000, 5000, 3000, 2000, { name: 'L' }, id);
    const bands = wallBands(r);
    // angle rentrant (3000, 3000) : la bande extérieure passe par (3072, 3072)
    expect(bands[2]![2]).toEqual([3072, 3072]);
    expect(bands[3]![3]).toEqual([3072, 3072]);
  });
});

describe('position du nom', () => {
  it('rectangle : au centre ; L : dans la grande partie, loin de l’angle rentrant', () => {
    const r = rectRoom(4000, 2000, { name: 'A' }, id).outline;
    expect(labelPoint(r)).toEqual([1875, 937.5]);
    const l = lRoom(6000, 5000, 3000, 2000, { name: 'L' }, id).outline;
    const [x, y] = labelPoint(l);
    // à plus de 1 m de l'angle rentrant (3000, 3000)
    expect(Math.hypot(x - 3000, y - 3000)).toBeGreaterThan(1000);
  });
});
