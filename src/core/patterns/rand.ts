import { hash } from '../hash';
import { rowCells } from './rows';
import { ICON_FRAME, rectGeo, type PatternModule } from './types';

/** Décalé aléatoire : chaque rangée décalée de 20 à 80 % du carreau, de façon déterministe. */
export const rand: PatternModule = {
  id: 'rand',
  label: 'Aléatoire',
  name: 'décalé aléatoire',
  icon: ICON_FRAME + '<path d="M1 8.3h32M1 15.7h32M9 1v7.3M22 1v7.3M15 8.3v7.4M28 8.3v7.4M5 15.7V23M19 15.7V23"/>',
  shape: 'rect',
  regular: false,
  rowIsA: false,
  geo: rectGeo,
  generate: (a, b, j, bb) => rowCells(a, b, j, bb, (k, A) => (0.2 + (hash(k * 7 + 3) % 600) / 1000) * A),
  period: (a, b, j) => [a + j, b + j],
};
