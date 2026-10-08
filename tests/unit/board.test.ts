import { describe, expect, it } from 'vitest';
import {
  BOARD_TEMPLATES,
  createBoard,
  meanLength,
  packArea,
  packMismatch,
  validateBoard,
} from '../../src/modules/parquet/core/board';

describe('lames de parquet', () => {
  it('longueur moyenne pondérée et surface d’un paquet', () => {
    expect(meanLength({ lengths: [1285], lengthMix: null })).toBe(1285);
    expect(meanLength({ lengths: [400, 1200], lengthMix: [0.75, 0.25] })).toBe(600);
    expect(meanLength({ lengths: [400, 1200], lengthMix: null })).toBe(800);
    expect(packArea({ lengths: [1000], lengthMix: null, width: 200, boardsPerPack: 10 })).toBe(2);
  });

  it('pack-mismatch au-delà de 3 % seulement', () => {
    const b = { lengths: [1000], lengthMix: null, width: 200, boardsPerPack: 10 };
    expect(packMismatch({ ...b, m2PerPack: 2.05 })).toBe(false);
    expect(packMismatch({ ...b, m2PerPack: 1.95 })).toBe(false);
    expect(packMismatch({ ...b, m2PerPack: 2.07 })).toBe(true);
    expect(packMismatch({ ...b, m2PerPack: 1.93 })).toBe(true);
    expect(packMismatch({ ...b, m2PerPack: 0 })).toBe(false);
  });

  it('modèles types : valides, cohérents, sans prix, identifiants stables', () => {
    expect(BOARD_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(BOARD_TEMPLATES.length).toBeLessThanOrEqual(10);
    for (const b of BOARD_TEMPLATES) {
      expect(validateBoard(b), b.name).toEqual([]);
      expect(packMismatch(b), b.name).toBe(false);
      expect(b.pricePerPack).toBeNull();
    }
    expect(new Set(BOARD_TEMPLATES.map((b) => b.id)).size).toBe(BOARD_TEMPLATES.length);
    expect(BOARD_TEMPLATES.filter((b) => b.handed)).toHaveLength(3);
  });

  it('erreurs du formulaire', () => {
    const b = createBoard('x', 0);
    expect(validateBoard(b)).toEqual([]);
    expect(
      validateBoard({
        ...b,
        name: ' ',
        lengths: [0, 600],
        lengthMix: [0.5],
        width: 0,
        thickness: -1,
        boardsPerPack: 2.5,
      }),
    ).toEqual(['name/empty', 'lengths/invalid', 'mix/count', 'width/invalid', 'thickness/invalid', 'pack/boards']);
    expect(validateBoard({ ...b, lengths: [600, 900], lengthMix: [0.5, 0.4] })).toEqual(['mix/sum']);
    expect(validateBoard({ ...b, lengths: [] })).toEqual(['lengths/empty']);
  });
});
