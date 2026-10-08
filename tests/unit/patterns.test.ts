import { describe, expect, it } from 'vitest';
import { area, centroid, clipBox, pointInPolygon } from '../../src/core/geometry/polygon';
import { PATTERNS, pattern } from '../../src/modules/carrelage/core/patterns/registry';
import type { BBox, Point } from '../../src/modules/carrelage/core/types';

const sizes: Record<string, [number, number]> = {
  hex: [200, 200],
  octo: [250, 250],
  basket: [300, 75],
};
const dims = (id: string): [number, number] => sizes[id] ?? [600, 300];

/** Pseudo-aléatoire reproductible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

describe.each(PATTERNS.map((p) => [p.id, p] as const))('motif %s', (id, P) => {
  const [a, b] = dims(id);

  it.each([0, 3])('pave le plan sans trou ni chevauchement (joint %i)', (j) => {
    const box: BBox = [-437, 1913, -251, 1377];
    const g = P.geo(a, b, j);
    const cells = P.generate(a, b, j, box, g);
    const clipped = cells.map((c) => clipBox(c.p, box[0], box[1], box[2], box[3])).filter((p) => p.length >= 3);
    const total = clipped.reduce((t, p) => t + area(p), 0);
    expect(total / ((box[1] - box[0]) * (box[3] - box[2]))).toBeCloseTo(1, 9);

    const r = rng(7);
    for (let n = 0; n < 300; n++) {
      const q: Point = [box[0] + r() * (box[1] - box[0]), box[2] + r() * (box[3] - box[2])];
      const hits = cells.filter((c) => pointInPolygon(q, c.p)).length;
      expect(hits).toBe(1);
    }
  });

  it.skipIf(id === 'herring' || id === 'rand')('est invariant par translation d’une période', () => {
    const j = 3,
      g = P.geo(a, b, j),
      [px, py] = P.period(a, b, j);
    const box: BBox = [0, 2000, 0, 2000];
    const key = (q: Point) => `${Math.round(q[0] * 1000)}|${Math.round(q[1] * 1000)}`;
    const set = new Set(P.generate(a, b, j, [-3000, 5000, -3000, 5000], g).map((c) => key(centroid(c.p))));
    for (const c of P.generate(a, b, j, box, g)) {
      const m = centroid(c.p);
      expect(set.has(key([m[0] + px, m[1]]))).toBe(true);
      expect(set.has(key([m[0], m[1] + py]))).toBe(true);
    }
  });

  it('a des départs et une icône', () => {
    const g = P.geo(a, b, 3);
    for (const q of [g.tl, g.ctr, g.jn]) expect(q.every(Number.isFinite)).toBe(true);
    expect(P.icon).toMatch(/^<(rect|path)/);
  });
});

describe('registre', () => {
  it('contient les 10 motifs, sans doublon', () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(10);
  });
  it('replie un motif inconnu sur droit', () => {
    expect(pattern('inconnu' as never).id).toBe('grid');
  });
  it('bâtons rompus : invariant par les vecteurs du réseau (B, B) et (A, −A)', () => {
    const P = pattern('herring'),
      A = 603,
      B = 303;
    const key = (q: Point) => `${Math.round(q[0] * 1000)}|${Math.round(q[1] * 1000)}`;
    const set = new Set(
      P.generate(600, 300, 3, [-4000, 6000, -4000, 6000], P.geo(600, 300, 3)).map((c) => key(centroid(c.p))),
    );
    for (const c of P.generate(600, 300, 3, [0, 1500, 0, 1500], P.geo(600, 300, 3))) {
      const m = centroid(c.p);
      expect(set.has(key([m[0] + B, m[1] + B]))).toBe(true);
      expect(set.has(key([m[0] + A, m[1] - A]))).toBe(true);
    }
  });
  it('vannerie : n lames par carré', () => {
    const g = pattern('basket').geo(300, 75, 3);
    expect(g.n).toBe(4);
    expect(g.p).toBeCloseTo(303 / 4, 12);
  });
  it('décalé aléatoire : décalage entre 20 et 80 % du carreau', () => {
    const P = pattern('rand');
    const cells = P.generate(600, 300, 0, [0, 600, 0, 3000], P.geo(600, 300, 0));
    for (const c of cells) {
      const off = (((c.p[0]![0] % 600) + 600) % 600) / 600;
      expect(off === 0 || (off >= 0.2 - 1e-9 && off <= 0.8 + 1e-9)).toBe(true);
    }
  });
});
