import { bondOffset, rowCells } from './rows';
import { ICON_FRAME, rectGeo, type PatternModule } from './types';

export const grid: PatternModule = {
  id: 'grid',
  label: 'Droit',
  name: 'droit',
  icon: ICON_FRAME + '<path d="M12 1v22M23 1v22M1 12h32"/>',
  shape: 'rect',
  regular: false,
  rowIsA: false,
  geo: rectGeo,
  generate: (a, b, j, bb) => rowCells(a, b, j, bb, bondOffset(1)),
  period: (a, b, j) => [a + j, b + j],
};
