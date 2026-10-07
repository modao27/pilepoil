import { rectPoly } from '../geometry/polygon';
import type { Point } from '../types';
import { collector, ICON_FRAME, type PatternModule } from './types';

/**
 * Bâtons rompus : réseau v1 = (B, B), v2 = (A, −A) ; cellule horizontale à la base,
 * verticale à base + (A, B − A). A = long + j, B = court + j.
 */
export const herring: PatternModule = {
  id: 'herring',
  label: 'Bâtons rompus',
  name: 'bâtons rompus',
  icon:
    ICON_FRAME + '<path d="M1 12l6-6 6 6 6-6 6 6 6-6M1 19l6-6 6 6 6-6 6 6 6-6M7 6v7M19 6v7M31 6v7M13 12v7M25 12v7"/>',
  shape: 'rect',
  regular: false,
  rowIsA: false,
  geo(a, b, j) {
    const A = Math.max(a, b) + j,
      B = Math.min(a, b) + j;
    return { tl: [j / 2, j / 2], ctr: [A / 2, B / 2], jn: [0, 0] };
  },
  generate(a, b, j, bb) {
    if (b > a) [a, b] = [b, a];
    const [minX, maxX, minY, maxY] = bb;
    const { out, push } = collector(bb);
    const A = a + j,
      B = b + j;
    const cs: Point[] = [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ];
    const ms = cs.map((q) => (q[0] + q[1]) / (2 * B)),
      ns = cs.map((q) => (q[0] - q[1]) / (2 * A)),
      pm = Math.ceil(A / B) + 2;
    for (let m = Math.floor(Math.min(...ms)) - pm; m <= Math.ceil(Math.max(...ms)) + pm; m++) {
      for (let n = Math.floor(Math.min(...ns)) - 2; n <= Math.ceil(Math.max(...ns)) + 2; n++) {
        const bx = m * B + n * A,
          by = m * B - n * A;
        push(rectPoly(bx, by, A, B), 0);
        push(rectPoly(bx + A, by + B - A, B, A), 1);
      }
    }
    return out;
  },
  period(a, b, j) {
    const A = Math.max(a, b) + j,
      B = Math.min(a, b) + j;
    return [A + B, A + B];
  },
};
