import { describe, expect, it } from 'vitest';
import {
  area,
  bbox,
  centroid,
  clipBox,
  clipHalf,
  clipRect,
  inset,
  insideConvex,
  onLine,
  pointInPolygon,
  rectPoly,
  signedArea,
} from '../../src/core/geometry/polygon';
import { hash } from '../../src/core/hash';
import type { Polygon } from '../../src/core/types';

const square = rectPoly(0, 0, 100, 100);
const hexagon = (r: number): Polygon =>
  Array.from({ length: 6 }, (_, t) => [r * Math.cos((t * Math.PI) / 3), r * Math.sin((t * Math.PI) / 3)]);

describe('aires et boîtes', () => {
  it('aire signée selon le sens', () => {
    expect(signedArea(square)).toBe(10000);
    expect(signedArea(square.slice().reverse())).toBe(-10000);
    expect(area(square.slice().reverse())).toBe(10000);
  });
  it('boîte et centre', () => {
    expect(
      bbox([
        [3, -2],
        [8, 5],
        [-1, 4],
      ]),
    ).toEqual([-1, 8, -2, 5]);
    expect(centroid(square)).toEqual([50, 50]);
  });
});

describe('inset', () => {
  it('rétracte un carré dans les deux sens de parcours', () => {
    expect(area(inset(square, 5))).toBeCloseTo(90 * 90, 9);
    expect(area(inset(square.slice().reverse(), 5))).toBeCloseTo(90 * 90, 9);
  });
  it('rétracte un hexagone de d (apothème diminué de d)', () => {
    const r = 100,
      ap = (r * Math.sqrt(3)) / 2,
      d = 3;
    const r2 = ((ap - d) * 2) / Math.sqrt(3);
    expect(area(inset(hexagon(r), d))).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * r2 * r2, 6);
  });
  it('renvoie le polygone tel quel si d ≤ 0', () => {
    expect(inset(square, 0)).toBe(square);
  });
  it('comme legacy, ne détecte pas un carré retourné par excès de rétraction', () => {
    // Le retournement est une symétrie centrale : le sens de parcours ne change pas.
    // Sans effet en pratique, d vaut joint/2.
    expect(area(inset(square, 60))).toBeCloseTo(400, 9);
  });
});

describe('découpes', () => {
  it('découpe par rectangle et boîte infinie', () => {
    expect(area(clipRect(rectPoly(-50, -50, 100, 100), 100, 100))).toBe(2500);
    expect(area(clipBox(square, -Infinity, 30, -Infinity, Infinity))).toBe(3000);
    expect(clipRect(rectPoly(200, 200, 10, 10), 100, 100)).toEqual([]);
  });
  it('découpe en biais conservée par demi-plan', () => {
    const tri = clipHalf(square, (p) => 100 - p[0] - p[1]);
    expect(area(tri)).toBeCloseTo(5000, 9);
  });
});

describe('tests de position', () => {
  it('point dans un convexe avec tolérance', () => {
    expect(insideConvex([50, 50], square)).toBe(true);
    expect(insideConvex([100.4, 50], square)).toBe(true);
    expect(insideConvex([100.6, 50], square)).toBe(false);
    expect(insideConvex([50, 50], square.slice().reverse())).toBe(true);
  });
  it('point sur une droite', () => {
    expect(onLine([5, 0.4], [0, 0], [10, 0])).toBe(true);
    expect(onLine([5, 0.6], [0, 0], [10, 0])).toBe(false);
    expect(onLine([5, 0], [0, 0], [0, 0])).toBe(false);
  });
  it('point dans un polygone concave', () => {
    const L: Polygon = [
      [0, 0],
      [100, 0],
      [100, 40],
      [40, 40],
      [40, 100],
      [0, 100],
    ];
    expect(pointInPolygon([20, 80], L)).toBe(true);
    expect(pointInPolygon([80, 80], L)).toBe(false);
  });
});

describe('hash', () => {
  it('est déterministe et reproduit legacy', () => {
    expect(hash(3)).toBe(hash(3));
    // valeurs calculées avec la fonction de legacy/calepinage.html
    expect([0, 1, 10].map(hash)).toEqual([2151315562, 2007667912, 2171272454]);
  });
});
