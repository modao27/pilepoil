/**
 * Surfaces du carrelage résolues depuis le plan et les zones : une surface par pose (N1 : une pose couvre des
 * zones d'une seule surface). Repère de la surface : boîte englobante des zones, y vers le bas. Fonctions pures ;
 * unités : mm.
 */
import { surfaceKey, zoneRegion } from '../../../core/coverage/geometry';
import type { Pose, SurfaceRef, Zone } from '../../../core/coverage/types';
import { union } from '../../../core/geometry/boolean';
import { signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';
import type { Plan, PlanRoom, WallOpening } from '../../../core/plan/types';
import { wallDirection, wallIndex, wallLength } from '../../../core/plan/walls';
import type { RoomJointsSpec } from '../core';
import type { RoomShape } from '../render/scene3d/placement';
import type { Id } from '../../../state/model';
import type { CarrelagePose, OpeningFinish, Surface, SurfaceOpening } from './model';

/** Finition par défaut d'une porte ou fenêtre du plan : profilé, tableaux sur les côtés et en haut. */
export const DEFAULT_FINISH: OpeningFinish = {
  covered: true,
  revealDepth: 0,
  reveals: { left: true, right: true, top: true, bottom: false },
};

const ALL_HIDDEN = { top: true, bottom: true, left: true, right: true };
const NONE_HIDDEN = { top: false, bottom: false, left: false, right: false };

/** Contour réorienté : contours d'aire > 0, trous d'aire < 0 (après un retournement d'axe). */
function oriented(rings: Polygon[]): Polygon[] {
  const outer = rings.reduce((best, r) => (Math.abs(signedArea(r)) > Math.abs(signedArea(best)) ? r : best));
  const flip = signedArea(outer) < 0;
  return flip ? rings.map((r) => [...r].reverse()) : rings;
}

function bboxOf(rings: Polygon[]): [number, number, number, number] {
  const pts = rings.flat();
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

/** Le contour est exactement le rectangle w × h : la surface n'a pas besoin de contour (calcul historique). */
function isFullRect(rings: Polygon[], w: number, h: number): boolean {
  return rings.length === 1 && Math.abs(Math.abs(signedArea(rings[0]!)) - w * h) < 1;
}

/** Nom d'une surface : « Cuisine, sol », « Cuisine, mur 2 ». */
export function surfaceName(plan: Plan, s: SurfaceRef): string {
  const room = plan.rooms.find((r) => r.id === s.room);
  if (!room) return '';
  return s.wall == null ? `${room.name}, sol` : `${room.name}, mur ${wallIndex(room, s.wall) + 1}`;
}

/**
 * Décalage entre le repère d'une surface de pose et celui où sont rangées ses réservations (position rangée =
 * position dans la surface + décalage) : mur, coin bas gauche de la boîte dans le repère du mur ; sol, écart avec
 * la boîte de la pièce (bord gauche, bord bas).
 */
function offsetOf(room: PlanRoom, floor: boolean, x0: number, y0: number, y1: number): [number, number] {
  if (!floor) return [x0, y0];
  const [rx0, , , ry1] = bboxOf([room.outline]);
  return [x0 - rx0, ry1 - y1];
}

export function reservationOffset(plan: Plan, s: Surface): [number, number] {
  const room = plan.rooms.find((r) => r.id === s.ref.room);
  if (!room) return [0, 0];
  return offsetOf(room, s.kind === 'floor', s.origin[0], s.origin[1], s.origin[1] + s.height);
}

/** Porte ou fenêtre du plan dans le repère d'une surface de mur (coin bas gauche de la boîte en x0, y0). */
function planOpening(o: WallOpening, finish: OpeningFinish | undefined, x0: number, y0: number): SurfaceOpening {
  const f = finish ?? DEFAULT_FINISH;
  return {
    id: o.id,
    source: 'plan',
    type: o.kind === 'window' ? 'window' : 'door',
    x: o.offset - x0,
    sill: o.sill - y0,
    width: o.width,
    height: o.height,
    covered: f.covered,
    revealDepth: f.revealDepth,
    reveals: f.reveals,
    projection: 0,
  };
}

/** Surface d'une pose : contour des zones, ouvertures, réglages. null si ses zones n'existent plus. */
export function poseSurface(
  plan: Plan,
  pose: Pose,
  zones: readonly Zone[],
  t: CarrelagePose,
  name: string,
): Surface | null {
  const mine = zones.filter((z) => z.pose === pose.id);
  const ref = mine[0]?.surface;
  const room = ref && plan.rooms.find((r) => r.id === ref.room);
  if (!ref || !room) return null;
  const regions = mine.map((z) => zoneRegion(plan, z)).filter((r): r is Polygon[] => !!r && r.length > 0);
  if (!regions.length) return null;
  const region = regions.length > 1 ? regions.slice(1).reduce((u, r) => union(u, r), regions[0]!) : regions[0]!;
  const [x0, x1, y0, y1] = bboxOf(region);
  const w = x1 - x0,
    h = y1 - y0;
  const floor = ref.wall == null;
  // sol : repère de la pièce (y vers le bas) ; mur : repère du mur (y vers le haut), retourné
  const local = floor
    ? region.map((r) => r.map((q): Point => [q[0] - x0, q[1] - y0]))
    : oriented(region.map((r) => r.map((q): Point => [q[0] - x0, y1 - q[1]])));
  const outline = isFullRect(local, w, h) ? null : local;
  const [dx, dy] = offsetOf(room, floor, x0, y0, y1);
  const reservations = t.reservations
    .filter((r) => r.surface.room === ref.room && r.surface.wall === ref.wall)
    .map(({ surface: _, ...r }): SurfaceOpening => ({ ...r, x: r.x - dx, sill: r.sill - dy, source: 'tiling' }));
  const openings = floor
    ? reservations
    : [
        ...room.openings.filter((o) => o.wall === ref.wall).map((o) => planOpening(o, t.openings[o.id], x0, y0)),
        ...reservations,
      ];
  return {
    id: pose.id,
    ref,
    name,
    kind: floor ? 'floor' : 'wall',
    width: w,
    height: h,
    outline,
    origin: [x0, y0],
    joint: t.joint,
    split: t.split,
    bands: t.bands,
    openings,
    plinth: floor ? t.plinth : null,
    hiddenEdges: floor ? (t.edgesHidden ? ALL_HIDDEN : NONE_HIDDEN) : t.hiddenEdges,
    junctionsCovered: t.junctionsCovered,
    outlineHidden: floor && t.edgesHidden,
  };
}

/** Une surface par pose de carrelage, dans l'ordre des poses ; les poses sans zone existante sont omises. */
export function resolveSurfaces(
  plan: Plan,
  poses: readonly Pose[],
  zones: readonly Zone[],
  settings: Readonly<Record<Id, CarrelagePose>>,
): Surface[] {
  // plusieurs poses sur une même surface : le nom de la pose les distingue
  const count = new Map<string, number>();
  for (const p of poses) {
    const z = zones.find((x) => x.pose === p.id);
    if (z) count.set(surfaceKey(z.surface), (count.get(surfaceKey(z.surface)) ?? 0) + 1);
  }
  return poses.flatMap((p) => {
    const t = Object.hasOwn(settings, p.id) ? settings[p.id]! : null;
    const z = zones.find((x) => x.pose === p.id);
    if (!t || !z) return [];
    const base = surfaceName(plan, z.surface);
    const s = poseSurface(
      plan,
      p,
      zones,
      t,
      (count.get(surfaceKey(z.surface)) ?? 0) > 1 ? `${base} · ${p.name}` : base,
    );
    return s ? [s] : [];
  });
}

/** Angle au début de chaque mur, vu de l'intérieur : rentrant (coin convexe de la pièce) ou sortant. */
export function roomCorners(room: PlanRoom): ('in' | 'out')[] {
  const n = room.walls.length;
  return room.walls.map((_, i) => {
    const a = wallDirection(room, (i - 1 + n) % n),
      b = wallDirection(room, i);
    return a[0] * b[1] - a[1] * b[0] < 0 ? 'out' : 'in';
  });
}

/** Première surface (indice du moteur) posée sur le sol ou le mur donné, ou null. */
function surfaceOn(surfaces: readonly Surface[], room: Id, wall: Id | null): number | null {
  const i = surfaces.findIndex((s) => s.ref.room === room && s.ref.wall === wall);
  return i < 0 ? null : i;
}

/** Joints des pièces entre leurs surfaces carrelées (silicone, profilés d'angle), pour le moteur. */
export function roomJoints(plan: Plan, surfaces: readonly Surface[], outerCovered: boolean): RoomJointsSpec[] {
  return plan.rooms.flatMap((room) => {
    const walls = room.walls.map((w) => surfaceOn(surfaces, room.id, w.id));
    const floor = surfaceOn(surfaces, room.id, null);
    if (floor == null && walls.every((w) => w == null)) return [];
    const perimeter = walls.reduce<number>((sum, s, i) => sum + (s != null ? wallLength(room, i) : 0), 0);
    return [{ walls, corners: roomCorners(room), outerCovered, floor, perimeter }];
  });
}

/** Pièce du plan pour la vue 3D : contour, hauteur, surfaces posées sur chaque mur et au sol. null si absente. */
export function roomShape(plan: Plan, surfaces: readonly Surface[], roomId: Id): RoomShape | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const floor = surfaceOn(surfaces, roomId, null);
  return {
    outline: room.outline,
    height: room.height,
    walls: room.walls.map((w) => {
      const i = surfaceOn(surfaces, roomId, w.id);
      return i == null ? null : { surface: i, x: surfaces[i]!.origin[0], y: surfaces[i]!.origin[1] };
    }),
    floor,
    floorOrigin: floor != null ? surfaces[floor]!.origin : [0, 0],
  };
}
