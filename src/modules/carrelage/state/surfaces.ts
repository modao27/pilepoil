/**
 * Surfaces du carrelage résolues depuis le plan commun : le sol d'une pièce (contour, obstacles) ou un mur
 * (longueur × hauteur carrelée, portes et fenêtres du plan), avec les réglages propres au carrelage.
 * Fonctions pures ; unités : mm.
 */
import { bbox, signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';
import type { Plan, PlanRoom, WallOpening } from '../../../core/plan/types';
import { wallDirection, wallLength } from '../../../core/plan/walls';
import type { RoomJointsSpec } from '../core';
import type { RoomShape } from '../render/scene3d/placement';
import type { Id } from '../../../state/model';
import type {
  Edges,
  FloorTiling,
  OpeningFinish,
  RoomTiling,
  Surface,
  SurfaceOpening,
  SurfaceRef,
  WallTiling,
} from './model';

/** Séparateur des identifiants de surface : absent des identifiants du plan, sans effet dans une adresse. */
const SEP = '~';

/** Identifiant d'une surface : `${roomId}~floor` ou `${roomId}~${wallId}`. */
export function surfaceId(ref: SurfaceRef): string {
  return `${ref.room}${SEP}${ref.wall ?? 'floor'}`;
}

/** Inverse de `surfaceId` ; null si l'identifiant est mal formé. */
export function parseSurfaceId(id: string): SurfaceRef | null {
  const k = id.lastIndexOf(SEP);
  if (k <= 0 || k === id.length - 1) return null;
  const wall = id.slice(k + 1);
  return { room: id.slice(0, k), wall: wall === 'floor' ? null : wall };
}

/** Finition par défaut d'une porte ou fenêtre du plan : profilé, tableaux sur les côtés et en haut. */
export const DEFAULT_FINISH: OpeningFinish = {
  covered: true,
  revealDepth: 0,
  reveals: { left: true, right: true, top: true, bottom: false },
};

const ALL_HIDDEN: Edges = { top: true, bottom: true, left: true, right: true };
const NONE_HIDDEN: Edges = { top: false, bottom: false, left: false, right: false };

/** Hauteur carrelée d'un mur : saisie, bornée par la hauteur de la pièce. */
export function wallHeight(room: PlanRoom, t: WallTiling): number {
  return Math.min(t.tiledHeight ?? room.height, room.height);
}

/** Sol : boîte englobante du contour ; contour et obstacles (trous, aire < 0) ramenés au coin haut gauche. */
export function floorSurface(room: PlanRoom, t: FloorTiling): Surface {
  const [x0, x1, y0, y1] = bbox(room.outline);
  const local = (p: Polygon): Polygon => p.map((q): Point => [q[0] - x0, q[1] - y0]);
  const ring = (p: Polygon, sign: 1 | -1) => (Math.sign(signedArea(p)) === sign ? p : p.slice().reverse());
  const outline = [ring(local(room.outline), 1), ...room.obstacles.map((o) => ring(local(o.outline), -1))];
  return {
    id: surfaceId({ room: room.id, wall: null }),
    ref: { room: room.id, wall: null },
    name: `${room.name}, sol`,
    kind: 'floor',
    width: x1 - x0,
    height: y1 - y0,
    outline,
    origin: [x0, y0],
    joint: t.joint,
    split: t.split,
    zones: t.zones,
    openings: t.reservations.map((r) => ({ ...r, source: 'tiling' })),
    plinth: t.plinth,
    hiddenEdges: t.edgesHidden ? ALL_HIDDEN : NONE_HIDDEN,
    junctionsCovered: t.junctionsCovered,
    outlineHidden: t.edgesHidden,
  };
}

/** Porte ou fenêtre du plan dans le repère du mur vu de l'intérieur (x depuis le début du mur). */
function planOpening(o: WallOpening, finish: OpeningFinish | undefined): SurfaceOpening {
  const f = finish ?? DEFAULT_FINISH;
  return {
    id: o.id,
    source: 'plan',
    type: o.kind === 'window' ? 'window' : 'door',
    x: o.offset,
    sill: o.sill,
    width: o.width,
    height: o.height,
    covered: f.covered,
    revealDepth: f.revealDepth,
    reveals: f.reveals,
    projection: 0,
  };
}

/** Mur i de la pièce : longueur du mur × hauteur carrelée, portes et fenêtres du plan puis réservations. */
export function wallSurface(room: PlanRoom, i: number, t: WallTiling): Surface {
  const wall = room.walls[i]!;
  return {
    id: surfaceId({ room: room.id, wall: wall.id }),
    ref: { room: room.id, wall: wall.id },
    name: `${room.name}, mur ${i + 1}`,
    kind: 'wall',
    width: wallLength(room, i),
    height: wallHeight(room, t),
    outline: null,
    origin: [0, 0],
    joint: t.joint,
    split: t.split,
    zones: t.zones,
    openings: [
      ...room.openings.filter((o) => o.wall === wall.id).map((o) => planOpening(o, t.openings[o.id])),
      ...t.reservations.map((r): SurfaceOpening => ({ ...r, source: 'tiling' })),
    ],
    plinth: null,
    hiddenEdges: t.hiddenEdges,
    junctionsCovered: t.junctionsCovered,
    outlineHidden: false,
  };
}

/** Surfaces carrelées d'une pièce : le sol, puis les murs dans l'ordre du contour. */
export function roomSurfaces(room: PlanRoom, t: RoomTiling): Surface[] {
  const out: Surface[] = [];
  if (t.floor) out.push(floorSurface(room, t.floor));
  room.walls.forEach((w, i) => {
    const wt = t.walls[w.id];
    if (wt) out.push(wallSurface(room, i, wt));
  });
  return out;
}

/** Toutes les surfaces carrelées, dans l'ordre des pièces du plan (ordre de calcul et de numérotation). */
export function resolveSurfaces(plan: Plan, rooms: Readonly<Record<Id, RoomTiling>>): Surface[] {
  return plan.rooms.flatMap((r) => (Object.hasOwn(rooms, r.id) ? roomSurfaces(r, rooms[r.id]!) : []));
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

/**
 * Joints des pièces entre leurs surfaces (silicone, profilés d'angle) ; `surfaces` est la liste résolue
 * (indices du moteur).
 */
export function roomJoints(
  plan: Plan,
  rooms: Readonly<Record<Id, RoomTiling>>,
  surfaces: readonly Surface[],
): RoomJointsSpec[] {
  const index = new Map(surfaces.map((s, i) => [s.id, i]));
  return plan.rooms.flatMap((room) => {
    const t = Object.hasOwn(rooms, room.id) ? rooms[room.id]! : null;
    if (!t) return [];
    const walls = room.walls.map((w) => index.get(surfaceId({ room: room.id, wall: w.id })) ?? null);
    const floor = index.get(surfaceId({ room: room.id, wall: null })) ?? null;
    const perimeter = walls.reduce<number>((sum, s, i) => sum + (s != null ? wallLength(room, i) : 0), 0);
    return [{ walls, corners: roomCorners(room), outerCovered: t.outerCornersCovered, floor, perimeter }];
  });
}

/** Avertissement du plan : réglages carrelage dont la pièce ou le mur n'existe plus. */
export type PlanWarning = { code: 'room-missing'; room: Id } | { code: 'wall-missing'; room: Id; wall: Id };

export function planWarnings(plan: Plan, rooms: Readonly<Record<Id, RoomTiling>>): PlanWarning[] {
  const out: PlanWarning[] = [];
  for (const [id, t] of Object.entries(rooms)) {
    const room = plan.rooms.find((r) => r.id === id);
    if (!room) {
      out.push({ code: 'room-missing', room: id });
      continue;
    }
    for (const w of Object.keys(t.walls)) {
      if (!room.walls.some((x) => x.id === w)) out.push({ code: 'wall-missing', room: id, wall: w });
    }
  }
  return out;
}

/**
 * Pièce du plan pour la vue 3D : contour, hauteur, indice de surface (liste résolue) de chaque mur et du sol.
 * null si la pièce n'existe pas.
 */
export function roomShape(plan: Plan, surfaces: readonly Surface[], roomId: Id): RoomShape | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const index = new Map(surfaces.map((s, i) => [s.id, i]));
  const floor = index.get(surfaceId({ room: roomId, wall: null })) ?? null;
  return {
    outline: room.outline,
    height: room.height,
    walls: room.walls.map((w) => index.get(surfaceId({ room: roomId, wall: w.id })) ?? null),
    floor,
    floorOrigin: floor != null ? surfaces[floor]!.origin : [0, 0],
  };
}
