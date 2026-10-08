import { describe, expect, it } from 'vitest';
import { buildSurface } from '../../src/modules/carrelage/core/cutting/buildSurface';
import { planCuts } from '../../src/modules/carrelage/core/cutting/planCuts';
import { polyComplement, symmetryAngles } from '../../src/modules/carrelage/core/cutting/polyReuse';
import { axisStarts, cutRect, placeRect } from '../../src/modules/carrelage/core/cutting/rectReuse';
import { rotateReq, rotations, type CutContext, type RectStock } from '../../src/modules/carrelage/core/cutting/stock';
import { area, rectPoly } from '../../src/core/geometry/polygon';
import { PATTERNS } from '../../src/modules/carrelage/core/patterns/registry';
import type { Piece, Settings, SurfaceSpec } from '../../src/modules/carrelage/core/types';
import { surface, tileFor, zone } from './fixtures';

const ctx: CutContext = { orientation: 'free', kerf: 2, minOffcut: 20 };
const settings: Settings = { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20 };
const tile = { n: 1, pieces: [] };
const fresh = (): RectStock => ({
  type: 'rect',
  w: 600,
  h: 300,
  area: 180000,
  f: { L: true, R: true, T: true, B: true },
  tile,
});

function pieces(s: SurfaceSpec): Piece[] {
  const r = buildSurface(s);
  if (!r.ok) throw new Error(r.error.code);
  return r.value.pieces;
}

describe('sens du carreau', () => {
  it('rotations permises', () => {
    expect(rotations('free')).toEqual([0, 1, 2, 3]);
    expect(rotations('180')).toEqual([0, 2]);
    expect(rotations('none')).toEqual([0]);
  });
  it('un quart de tour fait tourner les côtés requis', () => {
    expect(rotateReq({ L: true, R: false, T: false, B: false }, 1)).toEqual({ L: false, R: false, T: true, B: false });
    expect(rotateReq({ L: true, R: false, T: false, B: false }, 2)).toEqual({ L: false, R: true, T: false, B: false });
  });
  it('symétries des formes', () => {
    expect(symmetryAngles('hex', 'free')).toHaveLength(6);
    expect(symmetryAngles('octo', '180')).toHaveLength(2);
    expect(symmetryAngles('chevron', 'none')).toEqual([0]);
  });
});

describe('chutes rectangulaires', () => {
  it('départ sur un axe selon les bords d’usine', () => {
    expect(axisStarts(true, true, 600, 600, true, true)).toEqual(['a']);
    expect(axisStarts(true, true, 500, 600, true, true)).toBeNull();
    expect(axisStarts(true, false, 500, 600, false, true)).toBeNull();
    expect(axisStarts(false, true, 500, 600, false, true)).toEqual(['b']);
    expect(axisStarts(false, false, 500, 600, true, false)).toEqual(['b', 'a']);
  });

  it('découpe guillotine : chutes moins le trait de coupe, bords d’usine conservés', () => {
    const rems = cutRect(fresh(), 'a', 'a', 200, 300, ctx, tile);
    expect(rems).toHaveLength(1);
    expect(rems[0]).toMatchObject({ w: 398, h: 300, f: { L: false, R: true, T: true, B: true } });
  });

  it('chute plus petite que le minimum : abandonnée', () => {
    expect(cutRect(fresh(), 'a', 'a', 590, 300, ctx, tile)).toEqual([]);
  });

  it('une pièce qui exige un bord d’usine n’est pas taillée dans un côté coupé', () => {
    const O: RectStock = { ...fresh(), w: 398, f: { L: false, R: true, T: true, B: true }, area: 398 * 300 };
    expect(
      placeRect(200, 300, { L: true, R: false, T: false, B: false }, O, { ...ctx, orientation: 'none' }),
    ).toBeNull();
    // demi-tour : le côté L requis vient sur le bord d'usine R
    expect(
      placeRect(200, 300, { L: true, R: false, T: false, B: false }, O, { ...ctx, orientation: '180' }),
    ).not.toBeNull();
  });

  it('pièce trop grande : refusée', () => {
    expect(placeRect(700, 100, { L: false, R: false, T: false, B: false }, fresh(), ctx)).toBeNull();
  });
});

describe('chutes polygonales', () => {
  it('complément d’une coupe droite dans un carré centré', () => {
    const T = rectPoly(-100, -100, 200, 200);
    const P = rectPoly(-100, -100, 200, 60);
    const rem = polyComplement(P, T, { ...ctx, kerf: 0 });
    expect(area(rem!)).toBeCloseTo(200 * 140, 9);
    expect(area(polyComplement(P, T, ctx)!)).toBeCloseTo(200 * 138, 9);
    expect(polyComplement(P, T, { ...ctx, minOffcut: 150 })).toBeNull();
  });
});

describe('plan de découpe : invariants', () => {
  it.each(PATTERNS.map((p) => p.id))('%s : pièces d’un carreau ≤ aire du carreau, numéros uniques', (pid) => {
    const pcs = pieces(surface({ zones: [zone({ pattern: pid, angle: 45 }, tileFor(pid))] }));
    const plan = planCuts(pcs, settings);
    const ns = plan.groups.flatMap((g) => g.tiles.map((t) => t.n));
    expect(new Set(ns).size).toBe(ns.length);
    expect(Math.min(...ns)).toBe(1);
    for (const g of plan.groups) {
      for (const t of g.tiles) {
        const used = t.pieces.reduce((s, i) => s + (pcs[i]!.parts ?? []).reduce((u, q) => u + area(q), 0), 0);
        expect(used).toBeLessThanOrEqual(g.tileArea * (1 + 1e-9));
      }
      expect(g.cuts.length).toBe(g.tiles.reduce((s, t) => s + t.pieces.length, 0));
    }
    pcs.forEach((p, i) => expect(plan.source[i] == null).toBe(p.full));
  });

  it('sans réemploi : un carreau par coupe', () => {
    const pcs = pieces(surface({ zones: [zone({ angle: 45 })] }));
    const plan = planCuts(pcs, { ...settings, reuseOffcuts: false });
    expect(plan.reused.some(Boolean)).toBe(false);
    expect(plan.groups[0]!.tiles).toHaveLength(plan.groups[0]!.cuts.length);
  });

  it('les chutes se partagent entre surfaces d’un même produit', () => {
    const a = pieces(surface({ width: 2350, height: 1800 })),
      b = pieces(surface({ width: 1730, height: 1800 })).map((p) => ({ ...p, surface: 1 }));
    const together = planCuts([...a, ...b], settings);
    const apart = planCuts(a, settings).groups[0]!.tiles.length + planCuts(b, settings).groups[0]!.tiles.length;
    expect(together.groups).toHaveLength(1);
    expect(together.groups[0]!.zones).toEqual([
      { surface: 0, zone: 0 },
      { surface: 1, zone: 0 },
    ]);
    expect(together.groups[0]!.tiles.length).toBeLessThanOrEqual(apart);
  });

  it('les cabochons ne sont jamais réemployés', () => {
    const pcs = pieces(surface({ zones: [zone({ pattern: 'octo' }, tileFor('octo'))] }));
    const plan = planCuts(pcs, settings);
    const cab = plan.groups.find((g) => g.shape === 'cab')!;
    expect(cab.tiles).toHaveLength(cab.cuts.length);
  });
});
