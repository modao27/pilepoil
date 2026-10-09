/**
 * Vue de dessus d'une pièce du plan : chaque mur carrelé est déplié vers l'extérieur, posé à plat contre son
 * segment du contour (bas du mur sur le segment, haut vers l'extérieur). Pur ; mm, repère de la pièce.
 */
import type { Point, Polygon } from '../core';

/** Matrice SVG (a, b, c, d, e, f) : (x, y) → (a x + c y + e, b x + d y + f). */
export type Matrix = [number, number, number, number, number, number];

export interface Unfolded {
  /** Repère de la surface du mur (x le long du mur, y vers le bas) → repère de la pièce. */
  matrix: Matrix;
  /** Coins de la surface dépliée, repère de la pièce. */
  corners: Point[];
}

export const apply = (m: Matrix, p: Point): Point => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];

/** Mur i (du point i au point i + 1) de largeur `width` et de hauteur `height`, déplié vers l'extérieur. */
export function unfoldWall(
  outline: Polygon,
  i: number,
  width: number,
  height: number,
  /** Coin bas gauche de la surface dans le repère du mur (x depuis le début du mur, y depuis le sol). */
  offset: Point = [0, 0],
): Unfolded {
  const a = outline[i]!,
    b = outline[(i + 1) % outline.length]!;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const u: Point = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  // normale vers l'extérieur (contour en sens horaire à l'écran, y vers le bas)
  const n: Point = [u[1], -u[0]];
  const top = offset[1] + height;
  const matrix: Matrix = [
    u[0],
    u[1],
    -n[0],
    -n[1],
    a[0] + u[0] * offset[0] + n[0] * top,
    a[1] + u[1] * offset[0] + n[1] * top,
  ];
  const corners = (
    [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ] as Point[]
  ).map((p) => apply(matrix, p));
  return { matrix, corners };
}

/** Boîte englobante [x, y, largeur, hauteur] de points, avec une marge. */
export function boxOf(points: readonly Point[], margin: number): [number, number, number, number] {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs) - margin,
    y0 = Math.min(...ys) - margin;
  return [x0, y0, Math.max(...xs) + margin - x0, Math.max(...ys) + margin - y0];
}
