import { rectPoly } from '../geometry/polygon';
import { collector, ICON_FRAME, type PatternModule } from './types';

/** Vannerie : carrés S = long + j de n = round(S/(court + j)) lames, largeur ramenée à S/n − j. */
export const basket: PatternModule = {
  id: 'basket',
  label: 'Vannerie',
  name: 'vannerie',
  icon: ICON_FRAME + '<path d="M12 1v22M23 1v22M1 12h32M1 6.5h11M17.5 1v11M23 6.5h10M6.5 12v11M12 17.5h11M28 12v11"/>',
  shape: 'rect',
  regular: false,
  rowIsA: true,
  geo(a, b, j) {
    const S = a + j,
      n = Math.max(1, Math.round(S / (b + j))),
      p = S / n;
    return { tl: [j / 2, j / 2], ctr: [S / 2, p / 2], jn: [0, 0], n, p };
  },
  generate(a, _b, j, bb, g) {
    const [minX, maxX, minY, maxY] = bb;
    const { out, push } = collector(bb);
    const S = a + j,
      n = g.n!,
      p = g.p!;
    for (let i = Math.floor(minX / S) - 1; i <= Math.ceil(maxX / S) + 1; i++) {
      for (let k = Math.floor(minY / S) - 1; k <= Math.ceil(maxY / S) + 1; k++) {
        const x = i * S,
          y = k * S,
          odd = (i + k) & 1;
        for (let m = 0; m < n; m++) push(odd ? rectPoly(x + m * p, y, p, S) : rectPoly(x, y + m * p, S, p), odd);
      }
    }
    return out;
  },
  period: (a, _b, j) => [2 * (a + j), 2 * (a + j)],
};
