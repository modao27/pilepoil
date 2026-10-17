import { describe, expect, it } from 'vitest';
import { evaluate, formatNumber } from '../../src/ui/lib/calc';

describe('saisie avec calcul', () => {
  it.each<[string, number]>([
    ['240', 240],
    ['240-12', 228],
    ['120,5', 120.5],
    ['2 × 60 + 3', 123],
    ['(300+3)*4', 1212],
    ['300 / 4', 75],
    ['-5+10', 5],
    ['.5', 0.5],
    ['3x3', 9],
    ['10 − 2', 8],
    // espace des milliers à la française
    ['1 200', 1200],
  ])('« %s » = %d', (s, v) => {
    expect(evaluate(s)).toBeCloseTo(v, 12);
  });

  it.each(['', 'abc', '2+', '(3+4', '4/0', '1..2', 'alert(1)'])('« %s » refusé', (s) => {
    expect(evaluate(s)).toBeNull();
  });

  describe('unités de longueur', () => {
    it.each<[string, string, number]>([
      ['2,4 m', 'cm', 240],
      ['240 cm', 'cm', 240],
      ['2400 mm', 'cm', 240],
      ['1 m + 20 cm', 'cm', 120],
      ['2,4 m', 'mm', 2400],
      ['25 cm', 'mm', 250],
      ['12 mm', 'm', 0.012],
      ['3 m × 2', 'cm', 600],
      ['240', 'cm', 240],
    ])('« %s » dans un champ en %s = %d', (s, unit, v) => {
      expect(evaluate(s, unit)).toBeCloseTo(v, 9);
    });

    it('refuse une unité dans un champ qui n’est pas une longueur', () => {
      expect(evaluate('2 m', '%')).toBeNull();
      expect(evaluate('2 m')).toBeNull();
      expect(evaluate('45 cm', '°')).toBeNull();
    });

    it('ne confond pas « m » avec un autre mot', () => {
      expect(evaluate('2 mètres', 'cm')).toBeNull();
    });
  });

  it('affichage français', () => {
    expect(formatNumber(1205.5)).toBe('1205,5');
    expect(formatNumber(60)).toBe('60');
    expect(formatNumber(0.333, 2)).toBe('0,33');
  });
});
