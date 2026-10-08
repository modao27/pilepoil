import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { difference, intersection, offset, regionArea, union, type Region } from '../../src/core/geometry/boolean';
import { signedArea } from '../../src/core/geometry/polygon';
import type { Polygon } from '../../src/core/geometry/types';

const sq = (x: number, y: number, s: number): Polygon => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
];
const L: Polygon = [
  [0, 0],
  [6000, 0],
  [6000, 3000],
  [3000, 3000],
  [3000, 5000],
  [0, 5000],
];

describe('booléens', () => {
  it('pièces voisines : une seule région', () => {
    const u = union([sq(0, 0, 1000)], [sq(1000, 0, 1000)]);
    expect(u).toHaveLength(1);
    expect(regionArea(u)).toBe(2e6);
  });

  it('poteau dans une pièce : un trou en sens inverse', () => {
    const d = difference([L], [sq(1000, 1000, 200)]);
    expect(d).toHaveLength(2);
    expect(d.map((r) => Math.sign(signedArea(r))).sort()).toEqual([-1, 1]);
    expect(regionArea(d)).toBe(6000 * 3000 + 3000 * 2000 - 200 * 200);
  });

  it('poteau à cheval sur le bord, intersection, différence vide', () => {
    expect(regionArea(difference([L], [sq(2900, 2900, 200)]))).toBe(24e6 - 200 * 200 + 100 * 100);
    expect(regionArea(intersection([sq(0, 0, 1000)], [sq(500, 0, 1000)]))).toBe(5e5);
    expect(difference([L], [L])).toEqual([]);
    expect(intersection([sq(0, 0, 100)], [sq(500, 500, 100)])).toEqual([]);
  });

  it('décalage : agrandir, rétrécir, joints', () => {
    expect(regionArea(offset([sq(0, 0, 1000)], 10))).toBe(1020 * 1020);
    expect(regionArea(offset([sq(0, 0, 1000)], -10))).toBe(980 * 980);
    const round = regionArea(offset([sq(0, 0, 1000)], 10, 'round'));
    expect(round).toBeGreaterThan(1000 * 1000 + 4 * 1000 * 10);
    expect(round).toBeLessThan(1020 * 1020);
    // rétrécir la pièce en L de 10 mm (jeu de dilatation)
    const inner = offset([L], -10);
    expect(inner).toHaveLength(1);
    expect(regionArea(inner)).toBeCloseTo(5980 * 2980 + 2980 * 2000, -1);
    // trou : agrandi quand la région rétrécit
    const holed = difference([sq(0, 0, 1000)], [sq(400, 400, 200)]);
    expect(regionArea(offset(holed, -10))).toBe(980 * 980 - 220 * 220);
  });

  it('résultats arrondis au 1/100 mm, sortie déterministe', () => {
    const a: Region = [sq(0.123456, 0, 1000)];
    expect(
      union(a, [])[0]!
        .flat()
        .every((v) => Number.isInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9),
    ).toBe(true);
    expect(union([L], [sq(5000, 4000, 2000)])).toEqual(union([L], [sq(5000, 4000, 2000)]));
  });
});

describe('propriétés', () => {
  /** Polygone étoilé non convexe, sommets entiers (pas d'arrondi en entrée), sens horaire à l'écran. */
  const star = fc
    .record({
      cx: fc.integer({ min: -2000, max: 2000 }),
      cy: fc.integer({ min: -2000, max: 2000 }),
      radii: fc.array(fc.integer({ min: 200, max: 3000 }), { minLength: 5, maxLength: 16 }),
    })
    .map(({ cx, cy, radii }): Polygon =>
      radii.map((r, i) => {
        const a = (i / radii.length) * Math.PI * 2;
        return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)];
      }),
    )
    .filter((p) => signedArea(p) > 0);

  const perimeter = (p: Polygon) =>
    p.reduce((s, q, i) => {
      const r = p[(i + 1) % p.length]!;
      return s + Math.hypot(r[0] - q[0], r[1] - q[1]);
    }, 0);
  /** Écart d'aire permis : sommets nouveaux arrondis au 1/100 mm, soit au plus 0,01 mm le long du bord. */
  const tol = (...ps: Polygon[]) => 0.01 * ps.reduce((s, p) => s + perimeter(p), 0) + 1;

  it('aires : A∪B + A∩B = A + B, A∖B + A∩B = A', () => {
    fc.assert(
      fc.property(star, star, (a, b) => {
        const A = signedArea(a),
          B = signedArea(b);
        const u = regionArea(union([a], [b])),
          x = regionArea(intersection([a], [b])),
          d = regionArea(difference([a], [b]));
        expect(Math.abs(u + x - A - B)).toBeLessThanOrEqual(tol(a, b));
        expect(Math.abs(d + x - A)).toBeLessThanOrEqual(tol(a, b));
        expect(x).toBeLessThanOrEqual(Math.min(A, B) + tol(a, b));
      }),
    );
  });

  it('sorties orientées : contours > 0, et l’union est commutative', () => {
    fc.assert(
      fc.property(star, star, (a, b) => {
        const u = union([a], [b]);
        expect(u.some((r) => signedArea(r) > 0)).toBe(true);
        expect(regionArea(u)).toBe(regionArea(union([b], [a])));
      }),
    );
  });

  it('décalage arrondi : agrandir puis rétrécir ne perd pas de surface, l’inverse n’en ajoute pas', () => {
    fc.assert(
      fc.property(star, fc.integer({ min: 1, max: 50 }), (a, d) => {
        const A = signedArea(a);
        // fermeture et ouverture morphologiques ; tolérance : tracé des arcs (0,1 mm) le long du bord
        const t = 0.1 * perimeter(a) + 1;
        expect(regionArea(offset(offset([a], d, 'round'), -d, 'round'))).toBeGreaterThanOrEqual(A - t);
        expect(regionArea(offset(offset([a], -d, 'round'), d, 'round'))).toBeLessThanOrEqual(A + t);
      }),
    );
  });
});
