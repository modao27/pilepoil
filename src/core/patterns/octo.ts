import { SQRT2 } from '../constants';
import { collector, type PatternModule } from './types';

function icon(): string {
  let d = '';
  const S = 10,
    c = 2.93;
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 2; k++) {
      const x = 2 + i * S,
        y = 2 + k * S;
      d += `M${x + c} ${y}L${x + S - c} ${y}L${x + S} ${y + c}L${x + S} ${y + S - c}L${x + S - c} ${y + S}L${x + c} ${y + S}L${x} ${y + S - c}L${x} ${y + c}Z`;
    }
  }
  return '<path d="' + d + '"/>';
}

/** Octogone et cabochon : S = a + j, cabochon de côté s − j avec s = S/(1 + √2). */
export const octo: PatternModule = {
  id: 'octo',
  label: 'Octogone',
  name: 'octogone et cabochon',
  icon: icon(),
  shape: 'octo',
  regular: true,
  rowIsA: true,
  geo(a, _b, j) {
    const S = a + j;
    return { tl: [j / 2, j / 2], ctr: [S / 2, S / 2], jn: [S, S / 2], s: S / (1 + SQRT2) };
  },
  generate(a, _b, j, bb) {
    const [minX, maxX, minY, maxY] = bb;
    const { out, push } = collector(bb);
    const S = a + j,
      s = S / (1 + SQRT2),
      c = (S - s) / 2;
    for (let i = Math.floor(minX / S) - 1; i <= Math.ceil(maxX / S) + 1; i++) {
      for (let k = Math.floor(minY / S) - 1; k <= Math.ceil(maxY / S) + 1; k++) {
        const x = i * S,
          y = k * S;
        push(
          [
            [x + c, y],
            [x + S - c, y],
            [x + S, y + c],
            [x + S, y + S - c],
            [x + S - c, y + S],
            [x + c, y + S],
            [x, y + S - c],
            [x, y + c],
          ],
          0,
          'main',
        );
        const X = x + S,
          Y = y + S;
        push(
          [
            [X, Y - c],
            [X + c, Y],
            [X, Y + c],
            [X - c, Y],
          ],
          1,
          'cab',
        );
      }
    }
    return out;
  },
  period: (a, _b, j) => [a + j, a + j],
};
