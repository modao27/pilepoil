/**
 * Placement 3D des surfaces (mètres, y vers le haut), porté de wallFrames / sceneInstances de legacy.
 * Sol : (x, y) mm → (x, 0, y). Murs de la pièce : A le long de x (z = 0), B le long de z (x = L),
 * C retour le long de −x (z = l), D retour le long de −z (x = 0) ; normale vers l'intérieur.
 * Un mur se replie à chaque angle (rentrant : vers l'intérieur, sortant : vers l'extérieur).
 */
import type { ProjectSpec, SurfaceSpec } from '../../modules/carrelage';

export type Vec3 = [number, number, number];

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
  | { surface: number; kind: 'floor' }
  | { surface: number; kind: 'wall'; frames: WallFrame[]; wall: 'A' | 'B' | 'C' | 'D' | null };

export interface SceneLayout {
  instances: Instance[];
  /** Pièce (m) si la vue montre toute la pièce. */
  room: { length: number; width: number; height: number; missing: ('A' | 'B' | 'C' | 'D')[] } | null;
  /** Boîte englobante au sol [xmin, xmax, zmin, zmax] et hauteur, pour cadrer la caméra. */
  bounds: { x: [number, number]; z: [number, number]; h: number };
}

export const WALL_DEFS = {
  A: { base: [0, 0], dir: [1, 0] },
  B: { base: [1, 0], dir: [0, 1] },
  C: { base: [1, 1], dir: [-1, 0] },
  D: { base: [0, 1], dir: [0, -1] },
} as const;

/** Une seule surface : un mur déplié depuis l'origine, ou un sol. */
export function surfaceLayout(spec: ProjectSpec, index: number): SceneLayout {
  const s = spec.surfaces[index]!;
  if (s.kind === 'floor') {
    return {
      instances: [{ surface: index, kind: 'floor' }],
      room: null,
      bounds: { x: [0, s.width / 1000], z: [0, s.height / 1000], h: 0 },
    };
  }
  const frames = wallFrames(s);
  const pts = frames.flatMap((fr) => [fr.base, [fr.base[0] + fr.dir[0] * fr.len, fr.base[1] + fr.dir[1] * fr.len]]);
  return {
    instances: [{ surface: index, kind: 'wall', frames, wall: null }],
    room: null,
    bounds: {
      x: [Math.min(...pts.map((p) => p[0]!)), Math.max(...pts.map((p) => p[0]!))],
      z: [Math.min(...pts.map((p) => p[1]!)), Math.max(...pts.map((p) => p[1]!))],
      h: s.height / 1000,
    },
  };
}

/** Toute la pièce : sol et murs A à D aux positions de la pièce ; murs non carrelés signalés. */
export function roomLayout(spec: ProjectSpec, roomHeight: number): SceneLayout | null {
  const R = spec.room;
  if (!R) return null;
  const L = R.length / 1000,
    l = R.width / 1000,
    Hr = roomHeight / 1000;
  const instances: Instance[] = [];
  if (R.walls.floor != null && spec.surfaces[R.walls.floor]) instances.push({ surface: R.walls.floor, kind: 'floor' });
  const missing: ('A' | 'B' | 'C' | 'D')[] = [];
  for (const k of ['A', 'B', 'C', 'D'] as const) {
    const i = R.walls[k];
    const s = i != null ? spec.surfaces[i] : undefined;
    if (!s) {
      missing.push(k);
      continue;
    }
    const d = WALL_DEFS[k];
    const base: [number, number] = [d.base[0] * L, d.base[1] * l];
    instances.push({ surface: i!, kind: 'wall', frames: wallFrames(s, base, [d.dir[0], d.dir[1]]), wall: k });
  }
  return { instances, room: { length: L, width: l, height: Hr, missing }, bounds: { x: [0, L], z: [0, l], h: Hr } };
}

/** Position de caméra (legacy CAMS) : lacet, tangage, facteur de distance. */
export const CAMERA_PRESETS = {
  room: { face: [0, 0.4, 1.35], biais: [0.7, 0.7, 1.3], haut: [0.3, 1.35, 1.15] },
  wall: { face: [0, 0.05, 1.2], biais: [0.65, 0.12, 1.15], haut: [0.25, 0.6, 1.3] },
  floor: { face: [0, 0.8, 1.2], biais: [0.6, 0.55, 1.15], haut: [0, 1.45, 1.05] },
} as const;
export type CameraPreset = keyof (typeof CAMERA_PRESETS)['room'];

export const FOV = 50;

/** Cible et position de caméra pour un préréglage (comme drawPersp de legacy). */
export function cameraFor(lay: SceneLayout, preset: CameraPreset): { target: Vec3; position: Vec3 } {
  const kind = lay.room ? 'room' : lay.instances[0]?.kind === 'floor' ? 'floor' : 'wall';
  const [yaw, pitch, dist] = CAMERA_PRESETS[kind][preset];
  const { x, z, h } = lay.bounds;
  const span = Math.max(x[1] - x[0], z[1] - z[0], h, 0.5);
  const target: Vec3 = [
    (x[0] + x[1]) / 2,
    kind === 'room' ? Math.min(h / 2, 1.2) : kind === 'floor' ? 0 : Math.min(h / 2, 1.5),
    (z[0] + z[1]) / 2,
  ];
  const d = (dist * span * 0.55) / Math.tan(((FOV / 2) * Math.PI) / 180);
  return {
    target,
    position: [
      target[0] + d * Math.sin(yaw) * Math.cos(pitch),
      target[1] + d * Math.sin(pitch),
      target[2] + d * Math.cos(yaw) * Math.cos(pitch),
    ],
  };
}
