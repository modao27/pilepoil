/** Caméra de la scène 3D partagée : vues types (face, biais, haut) par genre de vue, champ de vision. */
import type { SceneFrame, Vec3 } from './types';

export const CAMERA_PRESETS = {
  room: { face: [0, 0.4, 1.35], biais: [0.7, 0.7, 1.3], haut: [0.3, 1.35, 1.15] },
  wall: { face: [0, 0.05, 1.2], biais: [0.65, 0.12, 1.15], haut: [0.25, 0.6, 1.3] },
  floor: { face: [0, 0.8, 1.2], biais: [0.6, 0.55, 1.15], haut: [0, 1.45, 1.05] },
} as const;
export type CameraPreset = keyof (typeof CAMERA_PRESETS)['room'];

export const FOV = 50;

/** Cible et position de caméra pour un préréglage (comme drawPersp de legacy). */
export function cameraFor(frame: SceneFrame, preset: CameraPreset): { target: Vec3; position: Vec3 } {
  const kind = frame.kind;
  const [yaw, pitch, dist] = CAMERA_PRESETS[kind][preset];
  const { x, z, h } = frame.bounds;
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
