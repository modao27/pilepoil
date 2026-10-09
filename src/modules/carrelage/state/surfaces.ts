/**
 * Surfaces du carrelage résolues depuis le plan et les zones : une surface par pose. Une pose couvre des zones
 * d'un sol ou de sols reliés (contour d'ensemble, passages compris), ou de murs d'une même pièce qui se suivent
 * (dépliés bout à bout, angles aux jonctions). Repère de la surface : boîte englobante des zones, y vers le bas.
 * Fonctions pures ; unités : mm.
 */
import { sameSurface, surfaceKey, surfacePolygon, zoneRegion } from '../../../core/coverage/geometry';
import { wallChain } from '../../../core/coverage/rules';
import type { Pose, SurfaceRef, Zone } from '../../../core/coverage/types';
import { union } from '../../../core/geometry/boolean';
import { signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';
import type { Plan, PlanRoom, WallOpening } from '../../../core/plan/types';
import { passageBand, wallDirection, wallIndex, wallLength } from '../../../core/plan/walls';
import type { RoomJointsSpec } from '../core';
import type { RoomShape } from '../render/scene3d/placement';
import type { Id } from '../../../state/model';
import type { CarrelagePose, OpeningFinish, Surface, SurfaceCorner, SurfaceOpening, SurfacePart } from './model';

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

const unionAll = (regions: Polygon[][]): Polygon[] =>
  regions.length > 1 ? regions.slice(1).reduce((u, r) => union(u, r), regions[0]!) : (regions[0] ?? []);

const shift = (rings: Polygon[], dx: number, dy: number): Polygon[] =>
  rings.map((r) => r.map((q): Point => [q[0] + dx, q[1] + dy]));

/** Nom d'une surface : « Cuisine, sol », « Cuisine, mur 2 ». */
export function surfaceName(plan: Plan, s: SurfaceRef): string {
  return partsName(plan, [s]);
}

/**
 * Nom des surfaces d'une pose : « Cuisine, mur 2 », « Cuisine, murs 1 et 2 », « Cuisine, murs 1 à 3 »,
 * « Séjour + Couloir, sol ».
 */
export function partsName(plan: Plan, refs: readonly SurfaceRef[]): string {
  const rooms = [...new Set(refs.map((r) => r.room))].flatMap((id) => plan.rooms.filter((r) => r.id === id));
  const room = rooms[0];
  if (!room || !refs.length) return '';
  if (refs[0]!.wall == null) return `${rooms.map((r) => r.name).join(' + ')}, sol`;
  const n = refs.map((r) => wallIndex(room, r.wall!) + 1);
  if (n.length === 1) return `${room.name}, mur ${n[0]}`;
  if (n.length === 2) return `${room.name}, murs ${n[0]} et ${n[1]}`;
  const ascending = n.every((v, i) => i === 0 || v === n[i - 1]! + 1);
  return ascending ? `${room.name}, murs ${n[0]} à ${n.at(-1)}` : `${room.name}, murs ${n.join(', ')}`;
}

/** Nom court d'une surface dans sa pièce : « mur 2 », « murs 1 à 3 », « sol » ; nom complet si autre pièce. */
export function nameIn(s: Pick<Surface, 'name'>, room: Pick<PlanRoom, 'name'>): string {
  const prefix = `${room.name}, `;
  return s.name.startsWith(prefix) ? s.name.slice(prefix.length) : s.name;
}

/** Hauteur carrelée d'un mur : haut de ses zones (toutes poses), mm ; null s'il n'est pas carrelé. */
export function tiledTop(plan: Plan, zones: readonly Zone[], ref: SurfaceRef): number | null {
  const tops = zones
    .filter((z) => sameSurface(z.surface, ref))
    .flatMap((z) => (zoneRegion(plan, z) ?? []).flat().map((q) => q[1]));
  return tops.length ? Math.max(...tops) : null;
}

/** La surface de pose couvre-t-elle cette surface du plan ? */
export const covers = (s: Pick<Surface, 'parts'>, ref: SurfaceRef): boolean =>
  s.parts.some((p) => sameSurface(p.ref, ref));

/**
 * Décalage entre le repère d'une surface de pose et celui où sont rangées ses réservations (position rangée =
 * position dans la surface + décalage) : mur, coin bas gauche de la pose dans le repère du mur ; sol, écart avec
 * la boîte de la pièce (bord gauche, bord bas). `x0, y0, y1` : boîte de la pose dans le repère de la surface.
 */
function offsetOf(room: PlanRoom, floor: boolean, x0: number, y0: number, y1: number): [number, number] {
  if (!floor) return [x0, y0];
  const [rx0, , , ry1] = bboxOf([room.outline]);
  return [x0 - rx0, ry1 - y1];
}

/** Décalage des réservations rangées sur la surface `ref` du plan (par défaut, la première de la pose). */
export function reservationOffset(plan: Plan, s: Surface, ref: SurfaceRef = s.ref): [number, number] {
  const part = s.parts.find((p) => sameSurface(p.ref, ref)) ?? s.parts[0];
  const room = part && plan.rooms.find((r) => r.id === part.ref.room);
  if (!part || !room) return [0, 0];
  return offsetOf(room, s.kind === 'floor', part.x, part.y, part.y + s.height);
}

/** Porte ou fenêtre du plan dans le repère d'une surface de mur (coin bas gauche de la pose en x0, y0). */
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

/** Réservations de la pose rangées sur la surface `ref`, dans le repère de la pose (décalage dx, dy). */
function reservationsOn(t: CarrelagePose, ref: SurfaceRef, dx: number, dy: number): SurfaceOpening[] {
  return t.reservations
    .filter((r) => sameSurface(r.surface, ref))
    .map(({ surface: _, ...r }): SurfaceOpening => ({ ...r, x: r.x - dx, sill: r.sill - dy, source: 'tiling' }));
}

/** Géométrie d'une pose : contour (repère de la surface), boîte, surfaces couvertes, angles, ouvertures. */
interface PoseShape {
  outline: Polygon[] | null;
  width: number;
  height: number;
  parts: SurfacePart[];
  corners: SurfaceCorner[];
  openings: SurfaceOpening[];
}

/** Angle au début du mur i (entre les murs i − 1 et i), degrés : 90 pour un angle droit. */
function cornerAngle(room: PlanRoom, i: number): number {
  const n = room.walls.length;
  const a = wallDirection(room, (i - 1 + n) % n),
    b = wallDirection(room, i);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
  return Math.round((180 - (Math.acos(dot) * 180) / Math.PI) * 100) / 100;
}

/** Murs d'une même pièce dépliés bout à bout dans l'ordre de la chaîne (repère du mur : y vers le haut). */
function wallsShape(plan: Plan, room: PlanRoom, zones: readonly Zone[], t: CarrelagePose): PoseShape | null {
  const ids = zones.map((z) => z.surface.wall!);
  const chain = wallChain(room, ids) ?? [...new Set(ids)];
  const off = new Map<Id, number>();
  let x = 0;
  for (const w of chain) {
    off.set(w, x);
    x += wallLength(room, wallIndex(room, w));
  }
  const regions = zones
    .map((z) => {
      const r = zoneRegion(plan, z);
      return r && r.length ? shift(r, off.get(z.surface.wall!)!, 0) : null;
    })
    .filter((r): r is Polygon[] => !!r);
  if (!regions.length) return null;
  const region = unionAll(regions);
  const [x0, x1, y0, y1] = bboxOf(region);
  const w = x1 - x0,
    h = y1 - y0;
  const local = oriented(region.map((r) => r.map((q): Point => [q[0] - x0, y1 - q[1]])));
  const types = roomCorners(room);
  const corners = chain.slice(1).flatMap((wall): SurfaceCorner[] => {
    const i = wallIndex(room, wall);
    const at = off.get(wall)! - x0;
    return at > 0 && at < w ? [{ x: at, type: types[i]!, angle: cornerAngle(room, i) }] : [];
  });
  const openings = chain.flatMap((wall) => {
    const dx = x0 - off.get(wall)!;
    const ref = { room: room.id, wall };
    return [
      ...room.openings.filter((o) => o.wall === wall).map((o) => planOpening(o, t.openings[o.id], dx, y0)),
      ...reservationsOn(t, ref, dx, y0),
    ];
  });
  return {
    outline: isFullRect(local, w, h) ? null : local,
    width: w,
    height: h,
    parts: chain.map((wall) => ({ ref: { room: room.id, wall }, x: x0 - off.get(wall)!, y: y0 })),
    corners,
    openings,
  };
}

/** Sols de pièces reliées, dans le repère du plan (y vers le bas), réunis par les passages entre elles. */
function floorsShape(plan: Plan, zones: readonly Zone[], t: CarrelagePose): PoseShape | null {
  const ids = new Set(zones.map((z) => z.surface.room));
  const rooms = plan.rooms.filter((r) => ids.has(r.id));
  const regions = zones
    .map((z) => {
      const room = rooms.find((r) => r.id === z.surface.room);
      const r = room && zoneRegion(plan, z);
      return room && r && r.length ? shift(r, room.origin[0], room.origin[1]) : null;
    })
    .filter((r): r is Polygon[] => !!r);
  if (!regions.length) return null;
  const bands =
    rooms.length > 1
      ? plan.passages
          .filter((p) => ids.has(p.a.room) && ids.has(p.b.room))
          .flatMap((p) => {
            const b = passageBand(plan, p);
            return b ? [[b]] : [];
          })
      : [];
  const region = unionAll([...regions, ...bands]);
  const [X0, X1, Y0, Y1] = bboxOf(region);
  const w = X1 - X0,
    h = Y1 - Y0;
  const local = shift(region, -X0, -Y0);
  const parts = rooms.map((r) => ({ ref: { room: r.id, wall: null }, x: X0 - r.origin[0], y: Y0 - r.origin[1] }));
  const openings = parts.flatMap((part) => {
    const room = rooms.find((r) => r.id === part.ref.room)!;
    const [dx, dy] = offsetOf(room, true, part.x, part.y, part.y + h);
    return reservationsOn(t, part.ref, dx, dy);
  });
  return { outline: isFullRect(local, w, h) ? null : local, width: w, height: h, parts, corners: [], openings };
}

/** Surface d'une pose : contour des zones, ouvertures, réglages. null si ses zones n'existent plus. */
export function poseSurface(
  plan: Plan,
  pose: Pose,
  zones: readonly Zone[],
  t: CarrelagePose,
  name: string,
): Surface | null {
  const mine = zones.filter((z) => z.pose === pose.id && surfacePolygon(plan, z.surface));
  const first = mine[0]?.surface;
  const room = first && plan.rooms.find((r) => r.id === first.room);
  if (!first || !room) return null;
  const floor = first.wall == null;
  const shape = floor ? floorsShape(plan, mine, t) : wallsShape(plan, room, mine, t);
  if (!shape) return null;
  const head = shape.parts[0]!;
  return {
    id: pose.id,
    ref: head.ref,
    parts: shape.parts,
    corners: shape.corners,
    name,
    kind: floor ? 'floor' : 'wall',
    width: shape.width,
    height: shape.height,
    outline: shape.outline,
    origin: [head.x, head.y],
    joint: t.joint,
    split: t.split,
    bands: t.bands,
    openings: shape.openings,
    plinth: floor ? t.plinth : null,
    hiddenEdges: floor ? (t.edgesHidden ? ALL_HIDDEN : NONE_HIDDEN) : t.hiddenEdges,
    junctionsCovered: t.junctionsCovered,
    outlineHidden: floor && t.edgesHidden,
  };
}

/** Surfaces du plan couvertes par une pose, dans l'ordre de la surface de pose (chaîne de murs, pièces du plan). */
function poseRefs(plan: Plan, pose: Id, zones: readonly Zone[]): SurfaceRef[] {
  const mine = zones.filter((z) => z.pose === pose && surfacePolygon(plan, z.surface));
  const first = mine[0]?.surface;
  if (!first) return [];
  if (first.wall == null) {
    const ids = new Set(mine.map((z) => z.surface.room));
    return plan.rooms.filter((r) => ids.has(r.id)).map((r) => ({ room: r.id, wall: null }));
  }
  const room = plan.rooms.find((r) => r.id === first.room)!;
  const ids = mine.map((z) => z.surface.wall!);
  return (wallChain(room, ids) ?? [...new Set(ids)]).map((wall) => ({ room: room.id, wall }));
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
    const base = partsName(plan, poseRefs(plan, p.id, zones));
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

/** Première surface (indice du moteur) qui couvre le sol ou le mur donné, et sa part ; null sinon. */
function surfaceOn(surfaces: readonly Surface[], room: Id, wall: Id | null): { i: number; part: SurfacePart } | null {
  for (let i = 0; i < surfaces.length; i++) {
    const part = surfaces[i]!.parts.find((p) => p.ref.room === room && p.ref.wall === wall);
    if (part) return { i, part };
  }
  return null;
}

/** Joints des pièces entre leurs surfaces carrelées (silicone, profilés d'angle), pour le moteur. */
export function roomJoints(plan: Plan, surfaces: readonly Surface[], outerCovered: boolean): RoomJointsSpec[] {
  return plan.rooms.flatMap((room) => {
    const walls = room.walls.map((w) => surfaceOn(surfaces, room.id, w.id)?.i ?? null);
    const floor = surfaceOn(surfaces, room.id, null)?.i ?? null;
    if (floor == null && walls.every((w) => w == null)) return [];
    const perimeter = walls.reduce<number>((sum, s, i) => sum + (s != null ? wallLength(room, i) : 0), 0);
    return [{ walls, corners: roomCorners(room), outerCovered, floor, perimeter }];
  });
}

/**
 * Pièce du plan pour la vue 3D : contour, hauteur, surfaces posées sur chaque mur et au sol. Une pose sur
 * plusieurs murs est dessinée une seule fois, depuis son premier mur (`draw`), repliée à ses angles. null si absente.
 */
export function roomShape(plan: Plan, surfaces: readonly Surface[], roomId: Id): RoomShape | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const floor = surfaceOn(surfaces, roomId, null);
  return {
    outline: room.outline,
    height: room.height,
    walls: room.walls.map((w) => {
      const on = surfaceOn(surfaces, roomId, w.id);
      if (!on) return null;
      const draw = on.part === surfaces[on.i]!.parts[0];
      return { surface: on.i, x: on.part.x, y: on.part.y, draw };
    }),
    floor: floor?.i ?? null,
    floorOrigin: floor ? [floor.part.x, floor.part.y] : [0, 0],
  };
}
