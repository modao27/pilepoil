import { SQRT2 } from '../../../../core/constants';
import { collector, ICON_FRAME, type PatternModule } from './types';

/**
 * Point de Hongrie : parallélogrammes en colonnes, w = (long + j)/√2, h = (court + j)·√2.
 * Colonnes gauche et droite en miroir : deux produits distincts (par 0 / 1).
 */
export const chevron: PatternModule = {
  id: 'chevron',
  label: 'Hongrie',
  name: 'point de Hongrie',
  icon:
    ICON_FRAME + '<path d="M1 7l8-5 8 5 8-5 8 5M1 14l8-5 8 5 8-5 8 5M1 21l8-5 8 5 8-5 8 5M9 1v22M17 1v22M25 1v22"/>',
  shape: 'chevron',
  regular: false,
  rowIsA: false,
  geo(a, b, j) {
    const w = (a + j) / SQRT2,
      h = (b + j) * SQRT2;
    return { tl: [j / 2, j / 2], ctr: [w / 2, w / 2 + h / 2], jn: [0, 0] };
  },
  generate(a, b, j, bb) {
    const [minX, maxX, minY, maxY] = bb;
    const { out, push } = collector(bb);
    const w = (a + j) / SQRT2,
      h = (b + j) * SQRT2;
    for (let i = Math.floor(minX / (2 * w)) - 1; i <= Math.ceil(maxX / (2 * w)) + 1; i++) {
      for (let k = Math.floor((minY - 2 * w) / h) - 1; k <= Math.ceil(maxY / h) + 1; k++) {
        const X = i * 2 * w,
          Y = k * h;
        push(
          [
            [X, Y],
            [X + w, Y + w],
            [X + w, Y + w + h],
            [X, Y + h],
          ],
          0,
        );
        push(
          [
            [X + w, Y + w],
            [X + 2 * w, Y],
            [X + 2 * w, Y + h],
            [X + w, Y + w + h],
          ],
          1,
        );
      }
    }
    return out;
  },
  period(a, b, j) {
    const w = (a + j) / SQRT2,
      h = (b + j) * SQRT2;
    return [2 * w, h];
  },
};
