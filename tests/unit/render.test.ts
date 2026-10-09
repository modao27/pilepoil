import { describe, expect, it } from 'vitest';
import { buildSurface, layoutZones } from '../../src/modules/carrelage/core';
import { hitTest, openingAt, pieceAt, zoneAt } from '../../src/modules/carrelage/render/hitTest';
import { fitView, panBy, toScreen, toWorld, zoomAt } from '../../src/render/view';
import { planDrawing } from '../../src/modules/carrelage/render/planSvg';
import { apply, boxOf, unfoldWall } from '../../src/modules/carrelage/render/roomTop';
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
  });
  const lay = layoutZones(s);

  it('ouverture (repère y vers le bas), zone', () => {
    expect(openingAt(s, [1200, 1000])).toBe(0);
    expect(openingAt(s, [1200, 1500])).toBe(-1);
    expect(zoneAt(lay.rects, 3, [10, 1001])).toBe(0);
    expect(zoneAt(lay.rects, 3, [10, 1500])).toBe(1);
  });

  it('priorité : ouverture, zone', () => {
    expect(hitTest(s, lay.rects, [1200, 1000])).toEqual({ kind: 'opening', index: 0 });
    expect(hitTest(s, lay.rects, [100, 2000])).toEqual({ kind: 'zone', index: 1 });
    expect(hitTest(s, lay.rects, [-500, -500])).toEqual({ kind: 'none' });
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

describe('vue de dessus d’une pièce', () => {
  const room: Polygon = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [0, 3000],
  ];

  it('mur déplié vers l’extérieur : bas du mur sur son segment, haut à l’extérieur', () => {
    // mur 1 (haut de la pièce) : l'extérieur est vers y < 0
    const top = unfoldWall(room, 0, 4000, 2000);
    expect(apply(top.matrix, [0, 2000])).toEqual([0, 0]);
    expect(apply(top.matrix, [4000, 2000])).toEqual([4000, 0]);
    expect(apply(top.matrix, [0, 0])).toEqual([0, -2000]);
    // mur 2 (droite) : x le long du mur vers le bas, haut du mur vers x > 4000
    const right = unfoldWall(room, 1, 3000, 1200);
    const [x, y] = apply(right.matrix, [3000, 0]);
    expect(x).toBeCloseTo(5200, 9);
    expect(y).toBeCloseTo(3000, 9);
    expect(boxOf([...top.corners, ...right.corners], 0)).toEqual([0, -2000, 5200, 5000]);
  });
});
