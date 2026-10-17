import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { area } from '../../src/core/geometry/polygon';
import { diagonalGap, surveyOutline, type SurveyWall } from '../../src/core/plan/survey';
import { validateRoom } from '../../src/core/plan/validate';
import { roomFromOutline } from '../../src/core/plan/factories';

const w = (length: number, corner = 90): SurveyWall => ({ length, corner });

describe('relevé mur après mur', () => {
  it('un rectangle de quatre angles droits ferme exactement', () => {
    const r = surveyOutline([w(4000), w(3000), w(4000), w(3000)])!;
    expect(r.gap).toBe(0);
    expect(r.outline).toEqual([
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ]);
    expect(area(r.outline)).toBe(12_000_000);
  });

  it('une pièce en L (un angle rentrant) ferme et a la bonne surface', () => {
    // 6 × 5 m dont un coin de 3 × 2 m retiré en bas à droite
    const r = surveyOutline([w(6000), w(3000), w(3000, 270), w(2000, 90), w(3000), w(5000)])!;
    expect(r.gap).toBeLessThan(0.01);
    expect(area(r.outline)).toBe(6000 * 5000 - 3000 * 2000);
    // le contour est un vrai contour de pièce : pas de mur qui se croise
    expect(
      validateRoom(
        roomFromOutline(
          r.outline,
          { name: 'L' },
          (() => {
            let n = 0;
            return () => 'i' + n++;
          })(),
        ),
      ),
    ).toEqual([]);
  });

  it('un coin mesuré à 135° : un pan coupé', () => {
    const r = surveyOutline([w(4000, 90), w(2000, 135), w(Math.hypot(1000, 1000), 135), w(2000, 90), w(1)])!;
    // la pièce ne ferme pas à 1 mm près avec un dernier mur arbitraire : l'écart est chiffré
    expect(r.gap).toBeGreaterThan(0);
  });

  it('l’écart de fermeture est la distance du bout du dernier mur au premier point', () => {
    // rectangle dont le dernier mur est trop court de 120 mm
    const r = surveyOutline([w(4000), w(3000), w(4000), w(2880)])!;
    expect(r.gap).toBeCloseTo(120, 6);
    expect(r.end[0]).toBeCloseTo(0, 6);
    expect(r.end[1]).toBeCloseTo(120, 6);
  });

  it('refuse moins de 3 murs, une longueur nulle ou un angle impossible', () => {
    expect(surveyOutline([w(1000), w(1000)])).toBeNull();
    expect(surveyOutline([w(1000), w(0), w(1000), w(1000)])).toBeNull();
    expect(surveyOutline([w(1000), w(1000, 0), w(1000), w(1000)])).toBeNull();
    expect(surveyOutline([w(1000), w(1000, 360), w(1000), w(1000)])).toBeNull();
  });

  it('propriété : tout rectangle relevé ferme, quelles que soient ses cotes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 20000 }), fc.integer({ min: 100, max: 20000 }), (a, b) => {
        const r = surveyOutline([w(a), w(b), w(a), w(b)])!;
        expect(r.gap).toBeLessThan(0.01);
        expect(area(r.outline)).toBeCloseTo(a * b, 3);
      }),
    );
  });

  it('diagonale de contrôle : mesurée − calculée', () => {
    const r = surveyOutline([w(4000), w(3000), w(4000), w(3000)])!;
    // diagonale du rectangle 4 × 3 m : 5 m
    expect(diagonalGap(r.outline, 0, 2, 5000)).toBe(0);
    expect(diagonalGap(r.outline, 0, 2, 5012)).toBe(12);
    expect(diagonalGap(r.outline, 1, 3, 4985)).toBe(-15);
    expect(diagonalGap(r.outline, 0, 0, 5000)).toBe(0);
  });
});
