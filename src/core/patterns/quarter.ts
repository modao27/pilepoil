import { bondOffset, rowCells } from './rows';
import { ICON_FRAME, rectGeo, type PatternModule } from './types';

export const quarter: PatternModule = {
  id: 'quarter',
  label: 'Décalé ¼',
  name: 'décalé ¼',
  icon:
    ICON_FRAME +
    '<path d="M1 8.3h32M1 15.7h32M12 1v7.3M23 1v7.3M3.8 8.3v7.4M14.8 8.3v7.4M25.8 8.3v7.4M6.5 15.7V23M17.5 15.7V23M28.5 15.7V23"/>',
  shape: 'rect',
  regular: false,
  rowIsA: false,
  geo: rectGeo,
  generate: (a, b, j, bb) => rowCells(a, b, j, bb, bondOffset(4)),
  period: (a, b, j) => [a + j, (b + j) * 4],
};
