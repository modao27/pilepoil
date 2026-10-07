import { bondOffset, rowCells } from './rows';
import { ICON_FRAME, rectGeo, type PatternModule } from './types';

export const third: PatternModule = {
  id: 'third',
  label: 'Décalé ⅓',
  name: 'décalé ⅓',
  icon:
    ICON_FRAME +
    '<path d="M1 8.3h32M1 15.7h32M12 1v7.3M23 1v7.3M8.3 8.3v7.4M19.3 8.3v7.4M30.3 8.3v7.4M4.7 15.7V23M15.7 15.7V23M26.7 15.7V23"/>',
  shape: 'rect',
  regular: false,
  rowIsA: false,
  geo: rectGeo,
  generate: (a, b, j, bb) => rowCells(a, b, j, bb, bondOffset(3)),
  period: (a, b, j) => [a + j, (b + j) * 3],
};
