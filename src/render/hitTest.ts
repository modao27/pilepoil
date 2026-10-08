/** Ce qui se trouve sous un point du plan (repère surface, mm). Lecture seule. */
import { pointInPolygon, type Piece, type Point, type SurfaceSpec, type ZoneRect } from '../modules/carrelage';

export type Hit =
  | { kind: 'opening'; index: number }
  | { kind: 'corner'; index: number }
  | { kind: 'zone'; index: number }
  | { kind: 'none' };

/** Ouverture contenant le point (la dernière dessinée d'abord). */
export function openingAt(s: SurfaceSpec, pt: Point): number {
  for (let i = s.openings.length - 1; i >= 0; i--) {
    const r = s.openings[i]!;
    const y0 = s.height - r.sill - r.height;
    if (pt[0] >= r.x && pt[0] <= r.x + r.width && pt[1] >= y0 && pt[1] <= y0 + r.height) return i;
  }
  return -1;
}

/** Angle de mur à moins de tol mm du point (murs seulement). */
export function cornerAt(s: SurfaceSpec, pt: Point, tol: number): number {
  if (s.kind === 'floor' || pt[1] < 0 || pt[1] > s.height) return -1;
  let best = -1,
    d = tol;
  s.corners.forEach((c, i) => {
    const e = Math.abs(c.x - pt[0]);
    if (e <= d) {
      d = e;
      best = i;
    }
  });
  return best;
}

/** Zone contenant le point, joints entre zones compris. */
export function zoneAt(rects: ZoneRect[], joint: number, pt: Point): number {
  const half = joint / 2 + 1;
  return rects.findIndex(
    (r) => pt[0] >= r.x - half && pt[0] <= r.x + r.w + half && pt[1] >= r.y - half && pt[1] <= r.y + r.h + half,
  );
}

/** Priorité comme legacy : ouverture, puis angle, puis zone. */
export function hitTest(s: SurfaceSpec, rects: ZoneRect[], pt: Point, cornerTol: number): Hit {
  const o = openingAt(s, pt);
  if (o >= 0) return { kind: 'opening', index: o };
  const c = cornerAt(s, pt, cornerTol);
  if (c >= 0) return { kind: 'corner', index: c };
  const z = zoneAt(rects, s.joint, pt);
  return z >= 0 ? { kind: 'zone', index: z } : { kind: 'none' };
}

/** Pièce posée sous le point. */
export function pieceAt(pieces: Piece[], pt: Point): number {
  return pieces.findIndex((p) => p.parts?.some((q) => pointInPolygon(pt, q)));
}
