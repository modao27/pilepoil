/**
 * Repère de pose : x le long des lames (axe du mur de référence tourné de l'angle de pose), y en travers.
 * Rotation pure (l'orientation des contours est conservée). Pur.
 */
import type { Point, Polygon } from '../../../core/geometry/types';

export interface Frame {
  /** Direction des lames (unitaire). */
  u: Point;
  /** Direction des rangs, u tourné d'un quart de tour. */
  v: Point;
}

/** Angle en degrés, sens horaire à l'écran (y vers le bas). */
export function layingFrame(reference: Point, angleDeg: number): Frame {
  const l = Math.hypot(reference[0], reference[1]) || 1;
  const r: Point = [reference[0] / l, reference[1] / l];
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a),
    s = Math.sin(a);
  const u: Point = [r[0] * c - r[1] * s, r[0] * s + r[1] * c];
  return { u, v: [-u[1], u[0]] };
}

export const toFrame = (f: Frame, p: Point): Point => [p[0] * f.u[0] + p[1] * f.u[1], p[0] * f.v[0] + p[1] * f.v[1]];
export const fromFrame = (f: Frame, p: Point): Point => [p[0] * f.u[0] + p[1] * f.v[0], p[0] * f.u[1] + p[1] * f.v[1]];
export const ringToFrame = (f: Frame, r: Polygon): Polygon => r.map((p) => toFrame(f, p));
export const ringFromFrame = (f: Frame, r: Polygon): Polygon => r.map((p) => fromFrame(f, p));
