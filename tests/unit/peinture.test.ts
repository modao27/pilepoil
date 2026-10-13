/** Moteur peinture (docs/peinture/SPEC.md §3, §6, §7) : cas chiffrés et invariants. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defaultPoseSettings } from '../../src/modules/peinture/core/defaults';
import { computePaint } from '../../src/modules/peinture/core/compute';
import { projectNeeds } from '../../src/modules/peinture/core/aggregate';
import { choosePacks } from '../../src/modules/peinture/core/packs';
import { rectRegion } from '../../src/modules/peinture/core/surface';
import type {
  SpecPaint,
  PaintPack,
  PaintPoseSettings,
  PaintSpec,
  SpecOpening,
  SpecZone,
} from '../../src/modules/peinture/core/types';

const PACKS: PaintPack[] = [
  { size: 1, price: 12 },
  { size: 2.5, price: 26 },
  { size: 5, price: 45 },
  { size: 10, price: 80 },
];

const paint = (id: string, o: Partial<SpecPaint> = {}): SpecPaint => ({
  id,
  name: id,
  role: 'finish',
  uses: ['walls', 'woodwork'],
  yield: 10,
  coats: 2,
  packs: PACKS,
  ...o,
});

const DOOR: SpecOpening = { id: 'door', kind: 'door', offset: 500, width: 830, sill: 0, height: 2040 };
const WINDOW: SpecOpening = { id: 'win', kind: 'window', offset: 700, width: 1200, sill: 900, height: 1250 };

/** Pièce 4000 × 3000, hauteur 2500, quatre murs entiers ; porte sur le mur 0, fenêtre sur le mur 1. */
function room(settings: Partial<PaintPoseSettings> = {}, paints: SpecPaint[] = [paint('white')]): PaintSpec {
  const lengths = [4000, 3000, 4000, 3000];
  const zones: SpecZone[] = lengths.map((L, i) => ({
    id: `z${i}`,
    room: 'r',
    wall: `w${i}`,
    region: rectRegion(0, 0, L, 2500),
    openings: i === 0 ? [DOOR] : i === 1 ? [WINDOW] : [],
  }));
  return {
    zones,
    wallLengths: Object.fromEntries(lengths.map((L, i) => [`w${i}`, L])),
    floorArea: 12_000_000,
    paints: Object.fromEntries(paints.map((p) => [p.id, p])),
    prices: {},
    settings: { ...defaultPoseSettings(), finish: 'white', ...settings },
  };
}

describe('surfaces', () => {
  it('cas de référence : brute 35 m², ouvertures 3,1932 m², nette 31,8068 m²', () => {
    const r = computePaint(room());
    expect(r.areas.gross).toBeCloseTo(35, 6);
    expect(r.areas.openings).toBeCloseTo(3.1932, 6);
    expect(r.areas.net).toBeCloseTo(31.8068, 6);
  });

  it('seuil : une ouverture de 1 m² pile n’est pas déduite, au-dessus oui', () => {
    const small: SpecOpening = { id: 'o', kind: 'window', offset: 100, width: 1000, sill: 900, height: 1000 };
    const s = room();
    s.zones[2]!.openings = [small];
    const r = computePaint(s);
    expect(r.areas.openings).toBeCloseTo(3.1932, 6);
    s.settings.openings.mode = 'all';
    expect(computePaint(s).areas.openings).toBeCloseTo(4.1932, 6);
  });

  it('mode none : rien n’est déduit', () => {
    const r = computePaint(room({ openings: { mode: 'none', threshold: 0 } }));
    expect(r.areas.net).toBeCloseTo(35, 6);
  });

  it('une zone de mur (soubassement jusqu’à 1200) est découpée avec ses ouvertures', () => {
    const s = room();
    s.zones = [{ ...s.zones[0]!, region: rectRegion(0, 0, 4000, 1200) }];
    // porte 830 × 1200 dans la zone ; 4,8 − 0,996 = 3,804
    const r = computePaint(s);
    expect(r.areas.gross).toBeCloseTo(4.8, 6);
    expect(r.areas.net).toBeCloseTo(4.8 - 0.83 * 1.2, 6);
  });

  it('ouvertures qui se recouvrent : déduites une seule fois, avec alerte', () => {
    const s = room({ openings: { mode: 'all', threshold: 0 } });
    s.zones[2]!.openings = [
      { id: 'a', kind: 'window', offset: 500, width: 1000, sill: 900, height: 1000 },
      { id: 'b', kind: 'window', offset: 1000, width: 1000, sill: 900, height: 1000 },
    ];
    const r = computePaint(s);
    expect(r.areas.openings).toBeCloseTo(3.1932 + 1.5, 6); // union de 500 à 2000 mm sur 1000 mm de haut
    expect(r.alerts.map((a) => a.code)).toContain('opening-overlap');
  });

  it('sans zone : surface nulle et alerte no-surface', () => {
    const s = room();
    s.zones = [];
    const r = computePaint(s);
    expect(r.areas.net).toBe(0);
    expect(r.alerts).toEqual([{ code: 'no-surface' }]);
  });
});

describe('litres et pots', () => {
  it('cas A : 6 998 mL, 1 × 5 L + 2 × 1 L = 69 €', () => {
    const r = computePaint(room());
    const p = r.products[0]!;
    expect(p.need).toBe(6998);
    expect(p.packs).toEqual([
      { size: 5, count: 1, price: 45 },
      { size: 1, count: 2, price: 12 },
    ]);
    expect(p.purchased).toBe(7000);
    expect(p.surplus).toBe(2);
    expect(p.cost).toBe(69);
    expect(r.cost).toBe(69);
  });

  it('cas B : plâtre neuf, apprêt 4 374 mL et finition 8 747 mL', () => {
    const r = computePaint(
      room({ support: 'plaster', primer: 'under' }, [paint('white'), paint('under', { role: 'primer', uses: [] })]),
    );
    expect(r.products.map((p) => [p.key, p.need])).toEqual([
      ['walls:primer', 4374],
      ['walls:finish', 8747],
    ]);
  });

  it('enduit : support à reprendre, 1 kg/m² avec marge, en grammes', () => {
    const filler = paint('filler', { role: 'filler', uses: [], packs: [{ size: 5, price: 20 }] });
    const r = computePaint(room({ filler: 'filler', fillerState: 'poor' }, [paint('white'), filler]));
    const f = r.products.find((p) => p.role === 'filler')!;
    expect(f.need).toBe(Math.ceil(31.8068 * 1.1 * 1000 - 1e-6));
    expect(f.packs).toEqual([{ size: 5, count: 7, price: 20 }]);
  });

  it('produit sans prix : coût nul inconnu', () => {
    const r = computePaint(room({}, [paint('white', { packs: [{ size: 5, price: null }] })]));
    expect(r.products[0]!.packs).toEqual([{ size: 5, count: 2, price: null }]);
    expect(r.cost).toBeNull();
  });

  it('choosePacks : 10 L plutôt que 5 + 5 quand c’est moins cher, surplus départage à coût égal', () => {
    expect(
      choosePacks(9500, [
        { size: 5, price: 45 },
        { size: 10, price: 80 },
      ])!.packs,
    ).toEqual([{ size: 10, count: 1, price: 80 }]);
    // coût égal : 2 × 5 L ou 1 × 10 L à 20 € → même volume, moins de pots
    expect(
      choosePacks(8000, [
        { size: 5, price: 10 },
        { size: 10, price: 20 },
      ])!.packs,
    ).toEqual([{ size: 10, count: 1, price: 20 }]);
    expect(choosePacks(0, PACKS)).toBeNull();
    expect(choosePacks(1000, [])).toBeNull();
  });
});

describe('boiseries et consommables', () => {
  it('cas C : plinthes 13,17 m × 100 mm = 1,317 m²', () => {
    const w = { ...defaultPoseSettings().woodwork, skirting: true, finish: 'white' };
    const r = computePaint(room({ woodwork: w }));
    expect(r.woodwork.skirtingLength).toBeCloseTo(13.17, 6);
    expect(r.woodwork.skirting).toBeCloseTo(1.317, 6);
    expect(r.products.map((p) => p.key)).toEqual(['walls:finish', 'woodwork:finish']);
  });

  it('huisseries et vantaux', () => {
    const w = { ...defaultPoseSettings().woodwork, frames: true, doors: true, finish: 'white' };
    const r = computePaint(room({ woodwork: w }));
    expect(r.woodwork.frames).toBeCloseTo((4910 * 120 + 4900 * 120) / 1e6, 6);
    expect(r.woodwork.doors).toBeCloseTo((830 * 2040 * 2) / 1e6, 6);
  });

  it('masquage, bâche, rouleau, brosse', () => {
    const s = room({ consumables: { masking: true, sheet: true, roller: true, brush: true } });
    s.prices = { 'peinture:consumable:brush': 8 };
    const r = computePaint(s);
    // murs 14 m + ouvertures 4,32 + 4,9 m = 23,22 m → 1 rouleau ; 12 m² → 1 bâche
    expect(r.consumables).toEqual([
      { id: 'masking', quantity: 1, unitPrice: null },
      { id: 'sheet', quantity: 1, unitPrice: null },
      { id: 'roller', quantity: 1, unitPrice: null },
      { id: 'brush', quantity: 1, unitPrice: 8 },
    ]);
    expect(r.cost).toBe(77);
  });
});

describe('alertes', () => {
  const codes = (s: PaintSpec) => computePaint(s).alerts.map((a) => a.code);

  it('pas de finition', () => expect(codes(room({ finish: null }))).toEqual(['no-product']));
  it('rendement manquant', () => expect(codes(room({}, [paint('white', { yield: 0 })]))).toContain('missing-yield'));
  it('sans conditionnement', () => expect(codes(room({}, [paint('white', { packs: [] })]))).toContain('no-pack'));
  it('support neuf sans apprêt', () => expect(codes(room({ support: 'plaster' }))).toContain('primer-missing'));
  it('teinte foncée sur ancien peint', () =>
    expect(codes(room({}, [paint('white', { tint: 'dark' })]))).toContain('dark-tint-coat'));
  it('produit hors usage', () =>
    expect(codes(room({}, [paint('white', { uses: ['woodwork'] })]))).toContain('product-use-mismatch'));
});

describe('invariants', () => {
  const settings = fc.record({
    coats: fc.integer({ min: 1, max: 4 }),
    margin: fc.double({ min: 0, max: 0.3, noNaN: true }),
    mode: fc.constantFrom('all', 'threshold', 'none' as const),
  });
  const withSettings = (c: { coats: number; margin: number; mode: 'all' | 'threshold' | 'none' }) =>
    room({ coats: c.coats, margin: c.margin, openings: { mode: c.mode, threshold: 1_000_000 } });

  it('0 ≤ nette ≤ brute ; none ≤ threshold ≤ all', () => {
    fc.assert(
      fc.property(settings, (c) => {
        const r = computePaint(withSettings(c));
        expect(r.areas.net).toBeGreaterThanOrEqual(0);
        expect(r.areas.net).toBeLessThanOrEqual(r.areas.gross + 1e-9);
      }),
    );
    const ded = (mode: 'all' | 'threshold' | 'none') =>
      computePaint(room({ openings: { mode, threshold: 1_000_000 } })).areas.openings;
    expect(ded('none')).toBeLessThanOrEqual(ded('threshold'));
    expect(ded('threshold')).toBeLessThanOrEqual(ded('all'));
  });

  it('litres croissants avec les couches et la marge, décroissants avec le rendement', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.double({ min: 0, max: 0.2, noNaN: true }),
        fc.double({ min: 5, max: 15, noNaN: true }),
        (coats, margin, y) => {
          const need = (c: number, m: number, yi: number) =>
            computePaint(room({ coats: c, margin: m }, [paint('white', { yield: yi })])).products[0]!.need;
          expect(need(coats + 1, margin, y)).toBeGreaterThanOrEqual(need(coats, margin, y));
          expect(need(coats, margin + 0.05, y)).toBeGreaterThanOrEqual(need(coats, margin, y));
          expect(need(coats, margin, y + 1)).toBeLessThanOrEqual(need(coats, margin, y));
        },
      ),
    );
  });

  it('les pots couvrent le besoin et coûtent au plus le meilleur format unique', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 60_000 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 4 }),
        fc.integer({ min: 1, max: 5 }),
        (need, sizes, perL) => {
          const packs = sizes.map((s) => ({ size: s, price: s * perL * 10 - s })); // dégressif léger
          const c = choosePacks(need, packs)!;
          expect(c.purchased).toBeGreaterThanOrEqual(need);
          const single = Math.min(...packs.map((p) => Math.ceil(need / (p.size * 1000)) * p.price!));
          expect(c.cost!).toBeLessThanOrEqual(single + 1e-9);
        },
      ),
      { numRuns: 60 },
    );
  }, 20_000); // propriété coûteuse : la limite de 5 s dépasse quand la suite tourne en parallèle

  it('déterminisme : même entrée, même JSON', () => {
    const a = JSON.stringify(computePaint(room()));
    expect(JSON.stringify(computePaint(room()))).toBe(a);
  });
});

describe('besoins du projet', () => {
  it('deux poses du même produit : besoins additionnés, une seule combinaison de pots', () => {
    const a = room();
    const b = room();
    const [need] = projectNeeds([a, b].map(computePaint), a.paints);
    expect(need!.need).toBe(6998 * 2);
    expect(need!.purchased).toBeGreaterThanOrEqual(13_996);
    expect(need!.cost!).toBeLessThanOrEqual(2 * 69);
  });
});
