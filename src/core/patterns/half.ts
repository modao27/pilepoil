import { bondOffset, rowCells } from './rows';
import { ICON_FRAME, rectGeo, type PatternModule } from './types';

export const half: PatternModule = {
  id: 'half',
  label: 'Décalé ½',
  name: 'décalé ½',
  icon:
    ICON_FRAME +
    '<path d="M1 8.3h32M1 15.7h32M12 1v7.3M23 1v7.3M6.5 8.3v7.4M17.5 8.3v7.4M28.5 8.3v7.4M12 15.7V23M23 15.7V23"/>',
  shape: 'rect',
  regular: false,
  rowIsA: false,
  geo: rectGeo,
  generate: (a, b, j, bb) => rowCells(a, b, j, bb, bondOffset(2)),
  period: (a, b, j) => [a + j, (b + j) * 2],
};
