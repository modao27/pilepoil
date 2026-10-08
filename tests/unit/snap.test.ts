import { describe, expect, it } from 'vitest';
import { buildSurface } from '../../src/core/cutting/buildSurface';
import { snapOffset } from '../../src/core/layout/snap';
import { surface, zone } from './fixtures';

const rc = { w: 2000, h: 1500 };

describe('aimantation du motif', () => {
  it('colle un bord de carreau au bord gauche de la zone', () => {
    const z = zone({ pattern: 'grid' });
    const r = snapOffset(z, rc, 3, { offsetX: 604.2, offsetY: 37 }, 10);
    expect(r.offsetX).toBeCloseTo(603, 9);
    expect(r.guideX).toBe(0);
  });

  it('colle au bord droit : la dernière colonne tombe entière', () => {
    const z = zone({ pattern: 'grid' });
    // bords de carreaux à 603k + 600 ; 2000 = 603·2 + 600 + 194 → décalage 194 pour finir pile à droite
    const r = snapOffset(z, rc, 3, { offsetX: 190, offsetY: 0 }, 10);
    expect(r.offsetX).toBeCloseTo(194, 9);
    expect(r.guideX).toBe(2000);
    const s = surface({ width: 2000, height: 1500, zones: [{ ...z, offsetX: r.offsetX }] });
    const res = buildSurface(s);
    if (!res.ok) throw new Error();
    const right = res.value.pieces.filter((p) => p.parts![0]!.some((q) => q[0] > 1999.9));
    expect(right.every((p) => p.full || p.ph < 300)).toBe(true);
  });

  it('hors de portée : seulement arrondi', () => {
    const r = snapOffset(zone({ pattern: 'grid' }), rc, 3, { offsetX: 300.4, offsetY: 150.6 }, 10);
    expect(r).toEqual({ offsetX: 300, offsetY: 151, guideX: null, guideY: null });
  });

  it('à 90° les bords restent alignés ; à 45°, pas d’aimantation', () => {
    expect(
      snapOffset(zone({ pattern: 'half', angle: 90 }), rc, 3, { offsetX: 2, offsetY: -3 }, 10).guideX,
    ).not.toBeNull();
    expect(snapOffset(zone({ pattern: 'half', angle: 45 }), rc, 3, { offsetX: 2, offsetY: -3 }, 10)).toMatchObject({
      guideX: null,
      guideY: null,
    });
  });
});
