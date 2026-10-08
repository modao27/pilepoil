import { rectPoly } from '../../../../core/geometry/polygon';
import type { BBox } from '../types';
import { collector, type Cell } from './types';

/** Pose en rangées horizontales ; offset(k) = décalage de la rangée k. */
export function rowCells(a: number, b: number, j: number, bb: BBox, offset: (k: number, A: number) => number): Cell[] {
  const [minX, maxX, minY, maxY] = bb;
  const { out, push } = collector(bb);
  const A = a + j,
    B = b + j;
  for (let k = Math.floor(minY / B) - 1; k <= Math.ceil(maxY / B) + 1; k++) {
    const off = offset(k, A);
    for (let i = Math.floor((minX - off) / A) - 1; i <= Math.ceil((maxX - off) / A) + 1; i++) {
      push(rectPoly(i * A + off, k * B, A, B), (i + k) & 1);
    }
  }
  return out;
}

/** Décalage régulier d'une fraction 1/per de carreau par rangée. */
export const bondOffset =
  (per: number) =>
  (k: number, A: number): number =>
    ((((k % per) + per) % per) * A) / per;
