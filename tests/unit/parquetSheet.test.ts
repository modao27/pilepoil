/** Fiche de coupe (docs/parquet/SPEC.md §5) : ordre de pose, regroupements, provenance des chutes. */
import { describe, expect, it } from 'vitest';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { boardShape, cutAngles, cuttingSheet, rives, type SheetItem } from '../../src/modules/parquet/core/sheet';
import { rect, spec } from './parquetHelpers';

const count = (items: SheetItem[]) => items.reduce((t, i) => t + (i.kind === 'full' ? i.count : 1), 0);

describe('fiche de coupe', () => {
  const r = computeParquet(spec(rect(4000, 3000)));
  const sheet = cuttingSheet(r);

  it('R1 : 16 rangs dans l’ordre, toutes les pièces une fois, numéros continus', () => {
    expect(sheet.map((g) => [g.kind, g.index])).toEqual(Array.from({ length: 16 }, (_, i) => ['row', i]));
    expect(sheet.reduce((t, g) => t + count(g.items), 0)).toBe(r.layouts[0]!.pieces.length);
    for (const g of sheet) {
      const ns = g.items.flatMap((i) => (i.kind === 'full' ? [i.from, i.to] : [i.n, i.n]));
      expect(ns[0]).toBe(1);
      for (let k = 2; k < ns.length; k += 2) expect(ns[k]).toBe(ns[k - 1]! + 1);
    }
    // les lames entières qui se suivent sont regroupées
    expect(sheet.some((g) => g.items.some((i) => i.kind === 'full' && i.count >= 2))).toBe(true);
  });

  it('pose droite : une chute est produite plus tôt dans l’ordre de pose que là où elle sert', () => {
    const pos = (g: number, n: number) => g * 1000 + n;
    let used = 0;
    sheet.forEach((g, gi) => {
      for (const i of g.items)
        if (i.kind === 'cut' && 'offcut' in i.source) {
          used++;
          expect(i.origin).not.toBeNull();
          expect(pos(i.origin!.group, i.origin!.n)).toBeLessThan(pos(gi, i.n));
        }
    });
    expect(used).toBeGreaterThan(0);
  });

  it('dernier rang recoupé en largeur : largeur posée indiquée', () => {
    const last = sheet.at(-1)!;
    const cut = last.items.find((i) => i.kind === 'cut');
    expect(cut && cut.kind === 'cut' && cut.width).toBeCloseTo(104, 0);
  });

  it('point de Hongrie : lignes le long de l’axe, rives des coupes en biais', () => {
    const h = computeParquet(
      spec(rect(3000, 2000), {
        board: { id: 'b', lengths: [600], lengthMix: null, width: 90, thickness: 10, handed: true, boardsPerPack: 12 },
        pattern: { kind: 'chevron', endAngle: 45 },
        axis: 'room-center',
      }),
    );
    const s = cuttingSheet(h);
    expect(s.every((g) => g.kind === 'line')).toBe(true);
    const angled = s.flatMap((g) => g.items).filter((i) => i.kind === 'cut' && i.cutType === 'angled');
    expect(angled.length).toBeGreaterThan(0);
    for (const i of angled) if (i.kind === 'cut' && i.edges) expect(i.edges[0]).toBeGreaterThanOrEqual(i.edges[1]);
    // chutes : provenance connue
    for (const i of s.flatMap((g) => g.items))
      if (i.kind === 'cut' && 'offcut' in i.source) expect(i.origin).not.toBeNull();
  });

  it('croquis d’une coupe en biais : pièce dans le repère de la lame, angles des coupes', () => {
    const shape = boardShape([
      [1000, 1000],
      [1000 + 600 / Math.SQRT2, 1000 + 600 / Math.SQRT2],
      [1000 + 600 / Math.SQRT2 - 90 / Math.SQRT2, 1000 + 600 / Math.SQRT2 + 90 / Math.SQRT2],
      [1000 - 90 / Math.SQRT2, 1000 + 90 / Math.SQRT2],
    ]);
    // rectangle 600 × 90 tourné de 45° : revient à plat, origine au coin
    expect(shape.map((p) => p.map((v) => Math.round(v)))).toEqual([
      [0, 0],
      [600, 0],
      [600, 90],
      [0, 90],
    ]);
    expect(cutAngles(shape)).toEqual([90, 90]);
    expect(
      cutAngles([
        [0, 0],
        [600, 0],
        [510, 90],
        [90, 90],
      ]),
    ).toEqual([45, 45]);
  });

  it('rives d’un parallélogramme à 45° : deux rives de même longueur', () => {
    expect(
      rives([
        [0, 0],
        [600, 0],
        [690, 90],
        [90, 90],
      ]),
    ).toEqual([600, 600]);
    expect(
      rives([
        [0, 0],
        [600, 0],
        [510, 90],
        [90, 90],
      ]),
    ).toEqual([600, 420]);
  });
});
