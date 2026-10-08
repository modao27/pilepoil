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

  it('affichage français', () => {
    expect(formatNumber(1205.5)).toBe('1205,5');
    expect(formatNumber(60)).toBe('60');
    expect(formatNumber(0.333, 2)).toBe('0,33');
  });
});
