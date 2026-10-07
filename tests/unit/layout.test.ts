import { describe, expect, it } from 'vitest';
import { layoutZones, rowThickness, zoneLength } from '../../src/core/layout/zones';
import { surface, zone } from './fixtures';

describe('zones', () => {
  it('épaisseur de rangée selon le sens des bandes et l’angle', () => {
    const z = zone({ pattern: 'grid' });
    expect(rowThickness(z, 'h')).toBe(300);
    expect(rowThickness(z, 'v')).toBe(600);
    expect(rowThickness({ ...z, angle: 90 }, 'h')).toBe(600);
    expect(rowThickness(zone({ pattern: 'hex' }, { width: 200, height: 200 }), 'v')).toBe(200);
  });

  it('longueur : rangées avec joints, longueur fixe, reste', () => {
    expect(zoneLength(zone({ unit: 'rows', size: 3 }), 'h', 3)).toBe(3 * 300 + 2 * 3);
    expect(zoneLength(zone({ unit: 'rows', size: 0 }), 'h', 3)).toBe(0);
    expect(zoneLength(zone({ unit: 'length', size: 450 }), 'h', 3)).toBe(450);
    expect(zoneLength(zone({ unit: 'length', size: -5 }), 'h', 3)).toBe(0);
    expect(zoneLength(zone({ unit: 'rest' }), 'h', 3)).toBeNull();
  });

  it('répartit le reste et sépare les zones d’un joint', () => {
    const lay = layoutZones(
      surface({ height: 2400, zones: [zone({ unit: 'rows', size: 2 }), zone(), zone({ unit: 'length', size: 500 })] }),
    );
    expect(lay.rects.map((r) => [r.y, r.h])).toEqual([
      [0, 603],
      [606, 2400 - 603 - 500 - 6],
      [2400 - 500, 500],
    ]);
    expect(lay.over).toBeCloseTo(0, 9);
    expect(lay.left).toBe(0);
  });

  it('signale le dépassement et le reste non carrelé', () => {
    const over = layoutZones(
      surface({ zones: [zone({ unit: 'length', size: 2000 }), zone({ unit: 'length', size: 600 })] }),
    );
    expect(over.over).toBe(2000 + 3 + 600 - 2400);
    expect(over.rects[1]!.h).toBe(2400 - 2003);
    const gap = layoutZones(surface({ zones: [zone({ unit: 'length', size: 1000 })] }));
    expect(gap.left).toBe(1400);
  });

  it('bandes côte à côte', () => {
    const lay = layoutZones(surface({ split: 'v', zones: [zone({ unit: 'length', size: 1000 }), zone()] }));
    expect(lay.rects[1]).toMatchObject({ x: 1003, y: 0, w: 1997, h: 2400 });
  });
});
