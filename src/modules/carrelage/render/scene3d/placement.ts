/**
 * Placement 3D des surfaces (mètres, y vers le haut), porté de wallFrames / sceneInstances de legacy.
 * Plan de la pièce : (x, y) mm → (x, 0, y). Mur i : du point i au point i + 1 du contour, normale vers
 * l'intérieur (contour en sens horaire à l'écran). Un mur d'une surface seule se replie à chacun de ses angles
 * (rentrant : vers l'intérieur, sortant : vers l'extérieur).
 */
import type { Point, Polygon, ProjectSpec, SurfaceSpec } from '../../core';

import type { SceneFrame, Vec3 } from '../../../../render/scene3d/types';

export type { Vec3 };

/** Segment plan d'un mur entre deux angles. */
export interface WallFrame {
  /** Bornes du segment le long du mur (mm, repère surface). */
  x0: number;
  x1: number;
  /** Début du segment au sol (x, z en m). */
  base: [number, number];
  /** Direction du mur dans le plan (unitaire). */
  dir: [number, number];
  /** Normale vers la pièce. */
  n: Vec3;
  /** Longueur (m). */
  len: number;
  k: number;
  last: boolean;
}

export function wallFrames(
  s: SurfaceSpec,
  base0: [number, number] = [0, 0],
  dir0: [number, number] = [1, 0],
): WallFrame[] {
  const fs = s.corners
    .filter((f) => f.x > 1 && f.x < s.width - 1)
    .slice()
    .sort((a, b) => a.x - b.x);
  const bounds = [0, ...fs.map((f) => f.x), s.width],
    frames: WallFrame[] = [];
  let base: [number, number] = [base0[0], base0[1]],
    dir: [number, number] = [dir0[0], dir0[1]];
  for (let k = 0; k < bounds.length - 1; k++) {
    const len = (bounds[k + 1]! - bounds[k]!) / 1000;
    frames.push({
      x0: bounds[k]!,
      x1: bounds[k + 1]!,
      base,
      dir,
      n: [-dir[1], 0, dir[0]],
      len,
      k,
      last: k === bounds.length - 2,
    });
    base = [base[0] + dir[0] * len, base[1] + dir[1] * len];
    const f = fs[k];
    if (f) {
      const t = (((180 - Math.min(179, Math.max(1, f.angle))) * Math.PI) / 180) * (f.type === 'in' ? 1 : -1);
      dir = [dir[0] * Math.cos(t) - dir[1] * Math.sin(t), dir[0] * Math.sin(t) + dir[1] * Math.cos(t)];
    }
  }
  return frames;
}

/** Point d'un mur : x le long du mur (mm), hauteur Y (m), profondeur derrière le plan du mur (m, < 0 : devant). */
export function wallPoint(fr: WallFrame, x: number, Y: number, depth: number): Vec3 {
  const t = (x - fr.x0) / 1000;
  return [fr.base[0] + fr.dir[0] * t - fr.n[0] * depth, Y, fr.base[1] + fr.dir[1] * t - fr.n[2] * depth];
}

export function frameAt(frames: WallFrame[], x: number): WallFrame {
  return frames.find((fr) => x <= fr.x1 + 1e-6) ?? frames[frames.length - 1]!;
}

export type Instance =
  /** origin : coin haut gauche de la surface du sol au sol (m). */
  { surface: number; kind: 'floor'; origin: [number, number] } | { surface: number; kind: 'wall'; frames: WallFrame[] };

/** Mur nu (non carrelé) d'une pièce, au sol (m). */
export interface BareWall {
  base: [number, number];
  dir: [number, number];
  len: number;
}

export interface SceneLayout {
  instances: Instance[];
  /** Pièce (m) si la vue montre toute la pièce : contour au sol, hauteur, murs nus. */
  room: { outline: [number, number][]; height: number; bare: BareWall[] } | null;
  /** Boîte englobante au sol [xmin, xmax, zmin, zmax] et hauteur, pour cadrer la caméra. */
  bounds: { x: [number, number]; z: [number, number]; h: number };
}

/** Pièce du plan vue par la 3D (mm, repère de la pièce). */
export interface RoomShape {
  outline: Polygon;
  height: number;
  /** Indice de surface du moteur de chaque mur, dans l'ordre du contour ; null : mur nu. */
  walls: (number | null)[];
  floor: number | null;
  /** Coin haut gauche de la surface du sol dans le repère de la pièce. */
  floorOrigin: Point;
}

/** Une seule surface : un mur déplié depuis l'origine, ou un sol. */
export function surfaceLayout(spec: ProjectSpec, index: number): SceneLayout {
  const s = spec.surfaces[index]!;
  if (s.kind === 'floor') {
    return {
      instances: [{ surface: index, kind: 'floor', origin: [0, 0] }],
      room: null,
      bounds: { x: [0, s.width / 1000], z: [0, s.height / 1000], h: 0 },
    };
  }
  const frames = wallFrames(s);
  const pts = frames.flatMap((fr) => [fr.base, [fr.base[0] + fr.dir[0] * fr.len, fr.base[1] + fr.dir[1] * fr.len]]);
  return {
    instances: [{ surface: index, kind: 'wall', frames }],
    room: null,
    bounds: {
      x: [Math.min(...pts.map((p) => p[0]!)), Math.max(...pts.map((p) => p[0]!))],
      z: [Math.min(...pts.map((p) => p[1]!)), Math.max(...pts.map((p) => p[1]!))],
      h: s.height / 1000,
    },
  };
}

/** Toute la pièce du plan : sol à sa place, chaque mur carrelé le long de son segment, murs nus en plâtre. */
export function roomLayout(spec: ProjectSpec, r: RoomShape): SceneLayout {
  const pts = r.outline.map((p): [number, number] => [p[0] / 1000, p[1] / 1000]);
  const n = pts.length;
  const instances: Instance[] = [];
  if (r.floor != null && spec.surfaces[r.floor])
    instances.push({ surface: r.floor, kind: 'floor', origin: [r.floorOrigin[0] / 1000, r.floorOrigin[1] / 1000] });
  const bare: BareWall[] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % n]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len <= 0) return;
    const dir: [number, number] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const k = r.walls[i];
    const s = k != null ? spec.surfaces[k] : undefined;
    if (s) instances.push({ surface: k!, kind: 'wall', frames: wallFrames(s, a, dir) });
    else bare.push({ base: a, dir, len });
  });
  const xs = pts.map((p) => p[0]),
    zs = pts.map((p) => p[1]);
  const h = r.height / 1000;
  return {
    instances,
    room: { outline: pts, height: h, bare },
    bounds: { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)], h },
  };
}

/** Position de caméra (legacy CAMS) : lacet, tangage, facteur de distance. */
/** Genre de vue et boîte englobante, pour la scène partagée (render/scene3d). */
export function frameOf(lay: SceneLayout): SceneFrame {
  return { kind: lay.room ? 'room' : lay.instances[0]?.kind === 'floor' ? 'floor' : 'wall', bounds: lay.bounds };
}

export { CAMERA_PRESETS, FOV, type CameraPreset } from '../../../../render/scene3d/camera';
