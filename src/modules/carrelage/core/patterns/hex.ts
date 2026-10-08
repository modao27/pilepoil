import { SQRT3 } from '../../../../core/constants';
import type { Polygon } from '../types';
import { collector, type PatternModule } from './types';

function icon(): string {
  let d = '';
  const R = 4.6;
  for (let i = 0; i < 5; i++) {
    for (let k = 0; k < 3; k++) {
      const cx = 3 + i * R * 1.5,
        cy = 3 + k * R * SQRT3 + (i & 1 ? (R * SQRT3) / 2 : 0);
      if (cy > 22) continue;
      d += 'M';
      for (let t = 0; t < 6; t++) {
        const an = (t * Math.PI) / 3;
        d += (cx + R * Math.cos(an)).toFixed(1) + ' ' + (cy + R * Math.sin(an)).toFixed(1) + (t < 5 ? 'L' : 'Z');
      }
    }
  }
  return '<path d="' + d + '"/>';
}

/** Hexagone posé pointe à gauche ; a = largeur côté plat à côté plat. */
export const hex: PatternModule = {
  id: 'hex',
  label: 'Hexagone',
  name: 'hexagone',
  icon: icon(),
  shape: 'hex',
  regular: true,
  rowIsA: true,
  geo(a, _b, j) {
    const F = a + j,
      R = F / SQRT3;
    return { tl: [-R + j / 2, -F / 2 + j / 2], ctr: [0, 0], jn: [R, 0] };
  },
  generate(a, _b, j, bb) {
    const [minX, maxX, minY, maxY] = bb;
    const { out, push } = collector(bb);
    const F = a + j,
      R = F / SQRT3;
    for (let i = Math.floor(minX / (1.5 * R)) - 1; i <= Math.ceil(maxX / (1.5 * R)) + 1; i++) {
      for (let k = Math.floor(minY / F) - 2; k <= Math.ceil(maxY / F) + 1; k++) {
        const cx = i * 1.5 * R,
          cy = k * F + (i & 1 ? F / 2 : 0),
          p: Polygon = [];
        for (let t = 0; t < 6; t++) {
          const an = (t * Math.PI) / 3;
          p.push([cx + R * Math.cos(an), cy + R * Math.sin(an)]);
        }
        push(p, (((i + 2 * k) % 3) + 3) % 3 === 0 ? 1 : 0);
      }
    }
    return out;
  },
  period(a, _b, j) {
    const F = a + j,
      R = F / SQRT3;
    return [3 * R, F];
  },
};
