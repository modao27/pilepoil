import { describe, expect, it } from 'vitest';
import { buildSurface, layoutZones } from '../../src/modules/carrelage/core';
import { cornerAt, hitTest, openingAt, pieceAt, zoneAt } from '../../src/modules/carrelage/render/hitTest';
import { fitView, panBy, toScreen, toWorld, zoomAt } from '../../src/render/view';
import { planDrawing } from '../../src/modules/carrelage/render/planSvg';
import type { Polygon } from '../../src/core/geometry/types';
import { surface, zone } from './fixtures';

describe('vue du plan', () => {
  it('cadre toute la surface, centrée, marges comprises', () => {
    const v = fitView(3000, 2000, 400, 400, { left: 40, top: 40, right: 0, bottom: 0 });
    expect(v.sc).toBeCloseTo(360 / 3000, 12);
    expect(toScreen(v, 0, 0)).toEqual([40, 40 + (360 - 2000 * v.sc) / 2]);
    const [x, y] = toWorld(v, ...toScreen(v, 1234, 567));
    expect(x).toBeCloseTo(1234, 9);
    expect(y).toBeCloseTo(567, 9);
  });

  it('zoom autour du doigt : le point visé ne bouge pas, échelle bornée', () => {
    const v = { sc: 0.1, ox: 10, oy: 20 };
    const w = zoomAt(v, 2, 110, 70, 0.1);
    expect(w.sc).toBe(0.2);
    expect(toWorld(w, 110, 70)).toEqual(toWorld(v, 110, 70));
    expect(zoomAt(v, 1000, 0, 0, 0.1).sc).toBeCloseTo(1.2, 12);
    expect(zoomAt(v, 0.001, 0, 0, 0.1).sc).toBeCloseTo(0.05, 12);
    expect(panBy(v, 5, -5)).toEqual({ sc: 0.1, ox: 15, oy: 15 });
  });
});

describe('sous le doigt', () => {
  const s = surface({
    width: 3000,
    height: 2400,
    zones: [zone({ unit: 'length', size: 1000 }), zone()],
    openings: [
      {
        type: 'window',
        x: 1000,
        sill: 1000,
        width: 800,
        height: 600,
        covered: true,
        revealDepth: 0,
        reveals: { L: true, R: true, T: true, B: false },
        projection: 0,
      },
    ],
    corners: [{ x: 2500, type: 'in', angle: 90, covered: true }],
  });
  const lay = layoutZones(s);

  it('ouverture (repère y vers le bas), angle, zone', () => {
    expect(openingAt(s, [1200, 1000])).toBe(0);
    expect(openingAt(s, [1200, 1500])).toBe(-1);
    expect(cornerAt(s, [2508, 100], 10)).toBe(0);
    expect(cornerAt({ ...s, kind: 'floor' }, [2500, 100], 10)).toBe(-1);
    expect(zoneAt(lay.rects, 3, [10, 1001])).toBe(0);
    expect(zoneAt(lay.rects, 3, [10, 1500])).toBe(1);
  });

  it('priorité : ouverture, angle, zone', () => {
    expect(hitTest(s, lay.rects, [1200, 1000], 10)).toEqual({ kind: 'opening', index: 0 });
    expect(hitTest(s, lay.rects, [2500, 2000], 10)).toEqual({ kind: 'corner', index: 0 });
    expect(hitTest(s, lay.rects, [100, 2000], 10)).toEqual({ kind: 'zone', index: 1 });
    expect(hitTest(s, lay.rects, [-500, -500], 10)).toEqual({ kind: 'none' });
  });

  it('pièce posée', () => {
    const r = buildSurface(s);
    if (!r.ok) throw new Error();
    const i = pieceAt(r.value.pieces, [5, 5]);
    expect(r.value.pieces[i]!.zone).toBe(0);
    expect(pieceAt(r.value.pieces, [1200, 1000])).toBe(-1);
  });
});

describe('plan SVG', () => {
  it('contour : rectangle par défaut, contour et trous d’un sol du plan', () => {
    const rect = surface({ width: 3000, height: 2000 });
    expect(planDrawing(rect, []).outline).toBe('M0 0H3000V2000H0Z');
    const L: Polygon[] = [
      [
        [0, 0],
        [3000, 0],
        [3000, 1000],
        [1500, 1000],
        [1500, 2000],
        [0, 2000],
      ],
      [
        [500, 500],
        [500, 700],
        [700, 700],
        [700, 500],
      ],
    ];
    const d = planDrawing({ ...rect, kind: 'floor', outline: L }, []);
    expect(d.outline).toBe('M0 0L3000 0L3000 1000L1500 1000L1500 2000L0 2000ZM500 500L500 700L700 700L700 500Z');
    expect(d.viewBox).toBe('0 0 3000 2000');
  });
});
