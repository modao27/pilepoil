import { SQRT2 } from '../constants';
import type { BBox } from '../geometry/types';
import { collector, ICON_FRAME, type Cell, type PatternModule } from './types';

/**
 * Point de Hongrie : parallélogrammes en colonnes, w = (long + j)/√2, h = (court + j)·√2.
 * Colonnes gauche et droite en miroir : deux produits distincts (par 0 / 1).
 */
export const chevron: PatternModule<'chevron'> = {
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
    return chevronCells(a, b, j, bb, 45);
  },
  period(a, b, j) {
    const w = (a + j) / SQRT2,
      h = (b + j) * SQRT2;
    return [2 * w, h];
  },
};

/**
 * Cellules du point de Hongrie pour un angle d'extrémité de 45° ou 60° (angle entre la rive de la lame et sa
 * coupe d'extrémité, parallèle à l'axe). Lame : long côté a (le long de la rive), largeur b, joint j.
 * Colonnes verticales de largeur w ; chaque lame descend de d sur sa largeur de colonne ; hauteur h le long
 * de l'axe. 45° : w = d = (a + j)/√2, h = (b + j)·√2 (calcul historique du carrelage, gardé à l'identique).
 */
export function chevronCells(a: number, b: number, j: number, bb: BBox, endAngle: 45 | 60): Cell[] {
  const [minX, maxX, minY, maxY] = bb;
  const { out, push } = collector(bb);
  let w: number, d: number, h: number;
  if (endAngle === 45) {
    w = (a + j) / SQRT2;
    d = w;
    h = (b + j) * SQRT2;
  } else {
    const t = (endAngle * Math.PI) / 180;
    w = (a + j) * Math.sin(t);
    d = (a + j) * Math.cos(t);
    h = (b + j) / Math.sin(t);
  }
  for (let i = Math.floor(minX / (2 * w)) - 1; i <= Math.ceil(maxX / (2 * w)) + 1; i++) {
    for (let k = Math.floor((minY - 2 * d) / h) - 1; k <= Math.ceil(maxY / h) + 1; k++) {
      const X = i * 2 * w,
        Y = k * h;
      push(
        [
          [X, Y],
          [X + w, Y + d],
          [X + w, Y + d + h],
          [X, Y + h],
        ],
        0,
      );
      push(
        [
          [X + w, Y + d],
          [X + 2 * w, Y],
          [X + 2 * w, Y + h],
          [X + w, Y + d + h],
        ],
        1,
      );
    }
  }
  return out;
}
