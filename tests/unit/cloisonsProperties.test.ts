/** Invariants du moteur des cloisons (docs/cloisons/SPEC.md §6), tests de propriétés. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeCloisons } from '../../src/modules/cloisons/core/compute';
import { defaultSettings } from '../../src/modules/cloisons/core/defaults';
import { joints } from '../../src/modules/cloisons/core/plates';
import type { End, SpecOpening, SpecPartition } from '../../src/modules/cloisons/core/types';
import { part, spec } from './cloisonsHelpers';

const s = defaultSettings();
const ends = fc.constantFrom<End>('wall', 'partition-t', 'partition-corner', 'free');
const plate = fc.constantFrom('standard' as const, 'hydro' as const, 'phonic' as const, 'fire' as const);

/** Cloison quelconque : longueur, hauteur, entraxe, système, 0 à 2 baies qui ne se touchent pas. */
const partition = fc
  .record({
    length: fc.integer({ min: 90, max: 700 }).map((n) => n * 10),
    height: fc.constantFrom(2400, 2500, 2600, 2700, 2800),
    spacing: fc.constantFrom<600 | 400>(600, 400),
    system: fc.constantFrom('s72', 's98'),
    a: plate,
    b: plate,
    start: ends,
    end: ends,
    junctions: fc.array(
      fc.integer({ min: 100, max: 650 }).map((n) => n * 10),
      { maxLength: 2 },
    ),
    openings: fc.array(
      fc.record({
        gap: fc.integer({ min: 20, max: 200 }),
        width: fc.integer({ min: 60, max: 110 }),
        height: fc.integer({ min: 190, max: 230 }),
      }),
      { maxLength: 2 },
    ),
  })
  .map((r): SpecPartition => {
    const openings: SpecOpening[] = [];
    let x = 0;
    for (const o of r.openings) {
      const offset = x + o.gap * 10;
      const width = o.width * 10;
      if (offset + width + 200 > r.length) break;
      openings.push({ id: `o${openings.length + 1}`, kind: 'door', offset, width, height: o.height * 10 });
      x = offset + width;
    }
    return part('p', {
      length: r.length,
      height: r.height,
      spacing: r.spacing,
      system: r.system,
      plates: { a: r.a, b: r.b },
      start: r.start,
      end: r.end,
      junctions: r.junctions.filter((j) => j < r.length - 200),
      openings,
    });
  });

const run = (p: SpecPartition) => computeCloisons(spec([p]));
const opts = { numRuns: 150 };

describe('invariants du moteur des cloisons', () => {
  it('1. rails : longueur totale = 2L − baies + linteaux ; barres ≥ borne basse', () => {
    fc.assert(
      fc.property(partition, (p) => {
        const r = run(p);
        const part0 = r.partitions[0]!;
        if (!part0.ok) return;
        const total = part0.rails.reduce((a, x) => a + x.length, 0);
        const expected =
          2 * p.length -
          p.openings.reduce((a, o) => a + o.width, 0) +
          p.openings.reduce((a, o) => a + o.width + 2 * s.lintelBearing, 0);
        expect(total).toBeCloseTo(expected, 6);
        const bars = Object.values(r.totals.rails).reduce((a, b) => a + b.bars.length, 0);
        expect(bars).toBeGreaterThanOrEqual(Math.ceil(total / s.railBar - 1e-9));
      }),
      opts,
    );
  });

  it('2. montants : triés, aucun montant de trame dans une baie ni près d’un montant renforcé', () => {
    fc.assert(
      fc.property(partition, (p) => {
        const studs = run(p).partitions[0]!.studs;
        expect(studs.map((q) => q.x)).toEqual([...studs.map((q) => q.x)].sort((a, b) => a - b));
        const reinforced = studs.filter((q) => !['grid', 'cripple'].includes(q.role));
        for (const g of studs.filter((q) => q.role === 'grid' || q.role === 'cripple')) {
          expect(reinforced.every((r) => Math.abs(r.x - g.x) >= s.studMinGap)).toBe(true);
          const inside = p.openings.some((o) => g.x > o.offset && g.x < o.offset + o.width);
          expect(g.role === 'cripple').toBe(inside);
        }
      }),
      opts,
    );
  });

  it('2 bis. un joint de plaque a un montant à moins de studMinGap, sauf alerte joint-at-jamb', () => {
    fc.assert(
      fc.property(partition, (p) => {
        const r = run(p);
        const res = r.partitions[0]!;
        if (!res.ok || res.alerts.some((a) => a.code === 'joint-at-jamb')) return;
        for (const { offset } of res.offsets)
          for (const x of joints(p.length, offset, 1200))
            expect(res.studs.some((q) => Math.abs(q.x - x) <= s.studMinGap)).toBe(true);
      }),
      opts,
    );
  });

  it('3. plaques : surface posée exacte, chaque pièce dans sa feuille, feuilles ≥ borne basse', () => {
    fc.assert(
      fc.property(partition, (p) => {
        const r = computeCloisons(spec([p], { plateMargin: 0 }));
        const res = r.partitions[0]!;
        if (!res.ok) return;
        const hp = p.height - s.plateGap;
        const expected = p.length * hp - p.openings.reduce((a, o) => a + o.width * Math.min(o.height, hp), 0);
        const layers = p.system === 's98' ? 2 : 1;
        for (const face of ['a', 'b'] as const)
          for (let l = 1; l <= layers; l++) {
            const area = res.plates.filter((q) => q.face === face && q.layer === l).reduce((a, q) => a + q.area, 0);
            expect(area).toBeCloseTo(expected, 3);
          }
        for (const q of res.plates) {
          expect(q.from).not.toBeNull();
          expect(q.width).toBeLessThanOrEqual(1200 + 1e-6);
          expect(q.height).toBeLessThanOrEqual(3000);
        }
        const sheetArea = (k: string) => Number(k.split('x')[0]) * Number(k.split('x')[1]);
        for (const lot of r.totals.plates) {
          const used = res.plates.filter((q) => q.type === lot.type).reduce((a, q) => a + q.area, 0);
          const bought = Object.entries(lot.sheets).reduce((a, [k, n]) => a + n * sheetArea(k), 0);
          expect(bought).toBeGreaterThanOrEqual(used - 1e-6);
        }
        // une chute n'est utilisée qu'une fois
        const used = res.plates.flatMap((q) => (q.from && 'offcut' in q.from ? [q.from.offcut] : []));
        expect(new Set(used).size).toBe(used.length);
      }),
      opts,
    );
  });

  it('4. joints : jamais ceux de deux couches ou de deux faces, sauf correction signalée', () => {
    fc.assert(
      fc.property(partition, (p) => {
        const res = run(p).partitions[0]!;
        if (!res.ok) return;
        const at = (f: string, l: number) => res.offsets.find((o) => o.face === f && o.layer === l)?.offset;
        const layers = p.system === 's98' ? 2 : 1;
        const coincide =
          [1, 2].slice(0, layers).some((l) => at('a', l) === at('b', l)) ||
          (layers > 1 && (at('a', 1) === at('a', 2) || at('b', 1) === at('b', 2)));
        if (coincide) expect(res.alerts.some((a) => ['joints-aligned', 'joint-at-jamb'].includes(a.code))).toBe(true);
        // aucun joint à moins de studMinGap d'un bord de baie, sauf alerte
        if (!res.alerts.some((a) => a.code === 'joint-at-jamb'))
          for (const { offset } of res.offsets)
            for (const x of joints(p.length, offset, 1200))
              for (const o of p.openings)
                for (const e of [o.offset, o.offset + o.width])
                  expect(Math.abs(x - e)).toBeGreaterThanOrEqual(s.studMinGap);
      }),
      opts,
    );
  });

  it('5. monotonie : plus de longueur ne réduit ni la surface de plaque ni la longueur de rail', () => {
    fc.assert(
      fc.property(partition, fc.integer({ min: 1, max: 30 }), (p, extra) => {
        const q = { ...p, length: p.length + extra * 100 };
        const a = run(p).partitions[0]!,
          b = run(q).partitions[0]!;
        if (!a.ok || !b.ok) return;
        const sum = (xs: { area?: number; length?: number }[], k: 'area' | 'length') =>
          xs.reduce((t, x) => t + (x[k] ?? 0), 0);
        expect(sum(b.plates, 'area')).toBeGreaterThanOrEqual(sum(a.plates, 'area') - 1e-6);
        expect(sum(b.rails, 'length')).toBeGreaterThanOrEqual(sum(a.rails, 'length') - 1e-6);
      }),
      opts,
    );
  });

  it('6. une cloison en erreur bloquante ne fausse pas les totaux', () => {
    fc.assert(
      fc.property(partition, (p) => {
        const alone = computeCloisons(spec([p]));
        const withBad = computeCloisons(spec([p, { ...part('bad'), height: 3300 }]));
        expect(withBad.partitions[1]!.ok).toBe(false);
        expect(withBad.totals).toEqual(alone.totals);
      }),
      { numRuns: 40 },
    );
  });

  it('7. déterminisme : même entrée, même résultat', () => {
    fc.assert(
      fc.property(fc.array(partition, { maxLength: 4 }), (ps) => {
        const list = ps.map((p, i) => ({
          ...p,
          id: `p${i}`,
          openings: p.openings.map((o) => ({ ...o, id: `p${i}${o.id}` })),
        }));
        const x = computeCloisons(spec(list));
        expect(JSON.stringify(computeCloisons(spec(list)))).toBe(JSON.stringify(x));
      }),
      { numRuns: 60 },
    );
  });
});
