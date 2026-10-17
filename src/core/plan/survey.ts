/**
 * Relevé sur place : une pièce décrite mur après mur (longueur, angle du coin qui suit), comme on la mesure au
 * mètre ou au laser. Pur : le contour, l'écart de fermeture et les diagonales de contrôle (docs/NAVIGATION.md).
 * Repère du plan : y vers le bas ; on parcourt la pièce dans le sens horaire (à l'écran), le premier mur vers la droite.
 */
import type { Point, Polygon } from '../geometry/types';

export interface SurveyWall {
  /** Longueur du mur, mm. */
  length: number;
  /** Angle intérieur du coin qui suit le mur, degrés : 90 (droit), 270 (rentrant) ou mesuré. Ignoré au dernier mur. */
  corner: number;
}

export interface SurveyResult {
  /** Un point par mur : début du mur, premier mur vers la droite, en (0, 0). */
  outline: Polygon;
  /** Fin du dernier mur : s'il ne retombe pas sur le premier point, la pièce ne ferme pas. */
  end: Point;
  /** Distance entre la fin du dernier mur et le premier point, mm. */
  gap: number;
}

/** Angle intérieur valable pour un coin : strictement entre 0 et 360. */
export const validCorner = (deg: number) => deg > 0 && deg < 360;

/**
 * Contour d'un relevé. Chaque coin tourne à droite de (180 − angle intérieur) degrés : 90° → virage droit, 270° →
 * coin rentrant (virage à gauche). Il faut au moins 3 murs de longueur positive et des angles valables.
 */
export function surveyOutline(walls: readonly SurveyWall[]): SurveyResult | null {
  if (walls.length < 3) return null;
  if (walls.some((w, i) => !(w.length > 0) || (i < walls.length - 1 && !validCorner(w.corner)))) return null;
  const outline: Point[] = [];
  let p: Point = [0, 0];
  let heading = 0; // radians, 0 = vers la droite ; positif = sens horaire à l'écran (y vers le bas)
  walls.forEach((w, i) => {
    outline.push(p);
    p = [p[0] + w.length * Math.cos(heading), p[1] + w.length * Math.sin(heading)];
    if (i < walls.length - 1) heading += ((180 - w.corner) * Math.PI) / 180;
  });
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    outline: outline.map(([x, y]) => [round(x), round(y)]),
    end: [round(p[0]), round(p[1])],
    gap: Math.round(Math.hypot(p[0], p[1]) * 100) / 100,
  };
}

/** Écart d'une diagonale de contrôle : mesurée − calculée entre les coins i et j (mm ; 0 si les coins n'existent pas). */
export function diagonalGap(outline: Polygon, i: number, j: number, measured: number): number {
  const a = outline[i],
    b = outline[j];
  if (!a || !b || i === j) return 0;
  return Math.round((measured - Math.hypot(a[0] - b[0], a[1] - b[1])) * 10) / 10;
}
