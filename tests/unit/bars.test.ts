/** Découpe de barres 1D partagée (src/core/cutting/bars.ts) : cas chiffrés et propriétés. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cutBars, minBars, type BarsInput } from '../../src/core/cutting/bars';

/** Chaque pièce est coupée en entier, une seule fois ; aucune barre ne déborde. */
function expectValid(input: BarsInput) {
  const r = cutBars(input);
  const allowance = input.mitreAllowance ?? 0;
  for (const p of input.pieces) {
    const parts = r.bars.flatMap((b) => b.cuts).filter((c) => c.id === p.id);
    const total = parts.reduce((t, c) => t + c.length, 0);
    expect(total).toBeCloseTo(p.length + (p.mitres ?? 0) * allowance, 1);
    expect(parts.map((c) => c.part).sort((a, b) => a - b)).toEqual(parts.map((_, i) => i + 1));
  }
  for (const b of r.bars) {
    const used = b.cuts.reduce((t, c) => t + c.length, 0) + (b.cuts.length - 1) * input.kerf;
    expect(used).toBeLessThanOrEqual(input.barLength + 1e-6);
    expect(b.rest).toBeGreaterThanOrEqual(0);
  }
  expect(r.bars.length).toBeGreaterThanOrEqual(minBars(input));
  return r;
}

describe('découpe de barres', () => {
  it('pièce de R1 : 4 murs de 4000 et 3000 en barres de 2400, trait 3 mm', () => {
    // 4000 = 2400 + 1600 ; 3000 = 2400 + 600 → 4 barres entières + 1600, 1600, 600, 600
    // 1600 + 600 + 3 ≤ 2400 (deux fois) → 6 barres au total
    const input = {
      pieces: [
        { id: 'n', length: 4000 },
        { id: 'e', length: 3000 },
        { id: 's', length: 4000 },
        { id: 'o', length: 3000 },
      ],
      barLength: 2400,
      kerf: 3,
    };
    const r = expectValid(input);
    expect(r.bars).toHaveLength(6);
    expect(r.offcuts).toEqual([197, 197]);
    expect(r.bars.flatMap((b) => b.cuts).filter((c) => c.id === 'n')).toHaveLength(2);
  });

  it('suppléments d’onglet ajoutés à chaque bout coupé d’angle', () => {
    const r = expectValid({
      pieces: [{ id: 'a', length: 1000, mitres: 2 }],
      barLength: 2400,
      kerf: 3,
      mitreAllowance: 10,
    });
    expect(r.bars[0]!.cuts[0]!.length).toBe(1020);
    expect(r.bars[0]!.rest).toBe(1380);
  });

  it('pièces exactes : deux pièces de 1198,5 tiennent dans 2400 avec un trait de 3', () => {
    const r = expectValid({
      pieces: [
        { id: 'a', length: 1198.5 },
        { id: 'b', length: 1198.5 },
      ],
      barLength: 2400,
      kerf: 3,
    });
    expect(r.bars).toHaveLength(1);
  });

  it('meilleur remplissage : 2 barres là où le premier ajustement décroissant en prend 3', () => {
    // barres de 10 : 5, 4, 4, 3, 2, 2 → premier ajustement [5, 4] [4, 3, 2] [2] ; optimum [5, 3, 2] [4, 4, 2]
    const pieces = [5, 4, 4, 3, 2, 2].map((length, i) => ({ id: `p${i}`, length: length * 100 }));
    const r = expectValid({ pieces, barLength: 1000, kerf: 0 });
    expect(r.bars).toHaveLength(2);
    expect(r.offcuts).toEqual([]);
  });

  it('rien à couper, barre nulle', () => {
    expect(cutBars({ pieces: [], barLength: 2400, kerf: 3 })).toEqual({ bars: [], offcuts: [] });
    expect(cutBars({ pieces: [{ id: 'a', length: 10 }], barLength: 0, kerf: 3 }).bars).toEqual([]);
  });

  it('déterministe', () => {
    const input = { pieces: [3, 1, 2, 5, 4].map((k) => ({ id: `p${k}`, length: k * 333 })), barLength: 2400, kerf: 3 };
    expect(cutBars(structuredClone(input))).toEqual(cutBars(input));
  });

  it('propriétés : toute entrée donne une découpe valide', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ length: fc.integer({ min: 1, max: 9000 }), mitres: fc.integer({ min: 0, max: 2 }) }), {
          maxLength: 30,
        }),
        fc.integer({ min: 500, max: 3000 }),
        fc.integer({ min: 0, max: 4 }),
        (ps, barLength, kerf) => {
          expectValid({
            pieces: ps.map((p, i) => ({ id: `p${i}`, ...p })),
            barLength,
            kerf,
            mitreAllowance: 10,
          });
        },
      ),
      { numRuns: 200 },
    );
  });
});
