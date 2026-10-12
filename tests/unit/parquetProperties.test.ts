/** Pose droite : invariants du §4.7 en tests de propriétés (temps de calcul : tests/perf). */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Polygon } from '../../src/core/geometry/types';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { RULES_BY_KIND } from '../../src/modules/parquet/core/defaults';
import type { BoardSpec, Pattern } from '../../src/modules/parquet/core/types';
import { expectInvariants, LAMINATE, rect, spec } from './parquetHelpers';

const room = fc.oneof(
  fc
    .record({ w: fc.integer({ min: 900, max: 7000 }), h: fc.integer({ min: 900, max: 6000 }) })
    .map(({ w, h }): Polygon => rect(w, h)),
  fc
    .record({
      w: fc.integer({ min: 2000, max: 7000 }),
      h: fc.integer({ min: 2000, max: 6000 }),
      cx: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
      cy: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
    })
    .map(({ w, h, cx, cy }): Polygon => {
      const x = Math.round(w * cx),
        y = Math.round(h * cy);
      return [
        [0, 0],
        [w, 0],
        [w, y],
        [x, y],
        [x, h],
        [0, h],
      ];
    }),
);

const board = fc
  .record({
    length: fc.integer({ min: 900, max: 2200 }),
    width: fc.integer({ min: 70, max: 240 }),
    mixed: fc.boolean(),
  })
  .map(({ length, width, mixed }): BoardSpec =>
    mixed
      ? { ...LAMINATE, lengths: [length - 400, length, length + 300], lengthMix: [0.3, 0.5, 0.2], width }
      : { ...LAMINATE, lengths: [length], width },
  );

const pattern = fc.constantFrom<Pattern>(
  { kind: 'random-stagger' },
  { kind: 'regular-stagger', step: 1 / 2 },
  { kind: 'regular-stagger', step: 1 / 3 },
  { kind: 'regular-stagger', step: 1 / 4 },
);

describe('pose droite : invariants', () => {
  it('aires, chevauchements, lames sources, règles, déterminisme', () => {
    fc.assert(
      fc.property(
        room,
        board,
        pattern,
        fc.oneof(fc.constantFrom(0, 90, 45), fc.integer({ min: 0, max: 179 })),
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 1, max: 1000 }),
        (outline, b, p, angle, always, post, seed) => {
          const xs = outline.map((q) => q[0]),
            ys = outline.map((q) => q[1]);
          const obstacles = post ? [rect(200, 200, Math.min(...xs) + 400, Math.min(...ys) + 400)] : [];
          const s = spec(
            outline,
            {
              board: b,
              pattern: p,
              angle,
              seed,
              rules: { ...RULES_BY_KIND.laminate, balanceEdgeRows: always ? 'always' : 'if-needed' },
            },
            obstacles,
          );
          const r = computeParquet(s);
          const l = r.layouts[0]!;
          expect(l.errors).toEqual([]);
          expectInvariants(l, s.layouts[0]!, 3);
          expect(computeParquet(structuredClone(s))).toEqual(r);
        },
      ),
      { numRuns: 60 },
    );
  }, 20000); // 60 tirages : large marge quand toute la suite tourne en parallèle
});
