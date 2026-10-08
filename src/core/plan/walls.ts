/** Géométrie des murs d'une pièce : segment, longueur, direction, ouvertures. Repère de la pièce sauf mention. */
import type { Point } from '../geometry/types';
import type { Id, PlanRoom, WallOpening } from './types';

/** Épaisseur par défaut d'un mur : cloison placo 72/48 (docs/BOITE.md §3). */
export const DEFAULT_WALL_THICKNESS = 72;

/** Tolérance des contrôles de passage (largeur, vis-à-vis), mm. */
export const PASSAGE_TOLERANCE = 10;

export function wallIndex(room: PlanRoom, wallId: Id): number {
  return room.walls.findIndex((w) => w.id === wallId);
}

/** Segment du mur i : du point i au point i + 1. */
export function wallSegment(room: PlanRoom, i: number): [Point, Point] {
  const n = room.outline.length;
  return [room.outline[i]!, room.outline[(i + 1) % n]!];
}

export function wallLength(room: PlanRoom, i: number): number {
  const [a, b] = wallSegment(room, i);
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Direction unitaire du mur i ([0, 0] pour un mur de longueur nulle). */
export function wallDirection(room: PlanRoom, i: number): Point {
  const [a, b] = wallSegment(room, i);
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return l > 0 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [0, 0];
}

/** Normale vers l'extérieur de la pièce (contour en sens horaire à l'écran, y vers le bas). */
export function outwardNormal(dir: Point): Point {
  return [dir[1], -dir[0]];
}

/** Centre d'une ouverture, dans le repère du plan d'ensemble (origine de la pièce ajoutée). */
export function openingCenter(room: PlanRoom, opening: WallOpening): Point | null {
  const i = wallIndex(room, opening.wall);
  if (i < 0) return null;
  const [a] = wallSegment(room, i);
  const u = wallDirection(room, i);
  const d = opening.offset + opening.width / 2;
  return [room.origin[0] + a[0] + u[0] * d, room.origin[1] + a[1] + u[1] * d];
}

/** Deux directions unitaires sont parallèles (même sens ou sens opposés). */
export function parallel(u: Point, v: Point): boolean {
  return Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-6 && (u[0] !== 0 || u[1] !== 0) && (v[0] !== 0 || v[1] !== 0);
}

/**
 * Tracé des murs vers l'extérieur, avec leur épaisseur : un quadrilatère par mur, angles en onglet
 * (les bandes de deux murs voisins se rejoignent sans trou ni chevauchement). Repère de la pièce.
 */
export function wallBands(room: PlanRoom): Point[][] {
  const n = room.outline.length;
  if (n < 3) return [];
  const outer: Point[] = room.outline.map((p, i) => {
    const prev = (i - 1 + n) % n;
    const d1 = wallDirection(room, prev),
      d2 = wallDirection(room, i);
    const n1 = outwardNormal(d1),
      n2 = outwardNormal(d2);
    const t1 = room.walls[prev]?.thickness ?? 0,
      t2 = room.walls[i]?.thickness ?? 0;
    // intersection des droites décalées p + n1·t1 + s·d1 et p + n2·t2 + u·d2
    const a: Point = [p[0] + n1[0] * t1, p[1] + n1[1] * t1];
    const b: Point = [p[0] + n2[0] * t2, p[1] + n2[1] * t2];
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) return b;
    const s = ((b[0] - a[0]) * d2[1] - (b[1] - a[1]) * d2[0]) / den;
    return [a[0] + d1[0] * s, a[1] + d1[1] * s];
  });
  return room.outline.map((p, i) => [p, room.outline[(i + 1) % n]!, outer[(i + 1) % n]!, outer[i]!]);
}
