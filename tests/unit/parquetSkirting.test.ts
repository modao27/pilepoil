/** Plinthes (docs/parquet/SPEC.md §4.5) : murs moins les portes, onglets aux angles, barres, obstacles. */
import { describe, expect, it } from 'vitest';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { PARQUET_MIGRATIONS } from '../../src/modules/parquet/state/model';
import { rect, spec } from './parquetHelpers';

describe('plinthes', () => {
  it('R1 : 4 murs, onglet aux deux bouts (+ 10 mm chacun), barres de 2400, trait 3', () => {
    const r = computeParquet(spec(rect(4000, 3000))).skirting;
    expect(r.pieces.map((p) => [p.wall, p.length, p.mitres])).toEqual([
      [0, 4000, 2],
      [1, 3000, 2],
      [2, 4000, 2],
      [3, 3000, 2],
    ]);
    // 4020 = 2400 + 1620 ; 3020 = 2400 + 620 ; 1620 + 3 + 620 ≤ 2400 (deux fois) → 4 + 2 = 6 barres
    expect(r.bars).toBe(6);
    expect(r.offcuts).toEqual([157, 157]);
  });

  it('R7 : la porte coupe le mur, coupe droite contre la porte, onglet à l’angle', () => {
    const s = spec(rect(4000, 3000));
    s.layouts[0]!.rooms[0]!.openings = [
      {
        segment: [
          [4000, 1000],
          [4000, 1830],
        ],
        kind: 'door',
      },
      {
        segment: [
          [0, 500],
          [0, 1700],
        ],
        kind: 'window',
      },
    ];
    const r = computeParquet(s).skirting;
    expect(r.pieces.filter((p) => p.wall === 1).map((p) => [p.length, p.mitres])).toEqual([
      [1000, 1],
      [1170, 1],
    ]);
    // fenêtre : pas d'ouverture au sol, le mur garde sa plinthe
    expect(r.pieces.filter((p) => p.wall === 3).map((p) => p.length)).toEqual([3000]);
  });

  it('autour des obstacles si l’option est cochée ; rien si les plinthes sont décochées', () => {
    const s = spec(rect(4000, 3000), {}, [rect(200, 200, 1000, 1000)]);
    expect(computeParquet(s).skirting.pieces.filter((p) => p.wall === -1)).toEqual([]);
    s.accessories = { ...s.accessories, skirting: { ...s.accessories.skirting, aroundObstacles: true } };
    expect(
      computeParquet(s)
        .skirting.pieces.filter((p) => p.wall === -1)
        .map((p) => p.length),
    ).toEqual([200, 200, 200, 200]);
    s.accessories = { ...s.accessories, skirting: { ...s.accessories.skirting, enabled: false } };
    expect(computeParquet(s).skirting).toEqual({ bars: 0, pieces: [], plan: [], offcuts: [] });
  });

  it('deux poses séparées sur la même pièce : ses murs comptés une fois', () => {
    const s = spec(rect(4000, 3000));
    s.layouts.push({ ...s.layouts[0]!, id: 'L2' });
    expect(computeParquet(s).skirting.pieces).toHaveLength(4);
  });

  it('migration 2 → 3 : option des obstacles décochée', () => {
    const v3 = PARQUET_MIGRATIONS[3]!({
      layouts: [],
      accessories: { skirting: { enabled: true, barLength: 2400, height: 60, mitreAllowance: 10 } },
    }) as { accessories: { skirting: { aroundObstacles: boolean } } };
    expect(v3.accessories.skirting.aroundObstacles).toBe(false);
  });
});
