import type { PatternId, SurfaceSpec, ZoneSpec } from '../../src/core/types';

/** Zone par défaut (valeurs par défaut de legacy). */
export function zone(o: Partial<ZoneSpec> = {}, tile: Partial<ZoneSpec['tile']> = {}): ZoneSpec {
  return {
    size: 3,
    unit: 'rest',
    pattern: 'half',
    angle: 0,
    start: 'corner',
    offsetX: 0,
    offsetY: 0,
    mix: 'solid',
    colorB: '#3f5a6b',
    groutColor: '#8f8a83',
    ...o,
    tile: { width: 600, height: 300, thickness: 9, color: '#d8cfc2', m2PerBox: 1.44, ...tile },
  };
}

/** Surface par défaut (mur 3000 × 2400, joint 3). */
export function surface(o: Partial<SurfaceSpec> = {}): SurfaceSpec {
  return {
    kind: 'wall',
    width: 3000,
    height: 2400,
    joint: 3,
    split: 'h',
    zones: [zone()],
    openings: [],
    corners: [],
    plinth: { length: 0, height: 80, zone: 0 },
    hiddenEdges: { T: true, B: true, L: true, R: true },
    junctionsCovered: false,
    ...o,
  };
}

/** Carreau type par motif. */
export function tileFor(p: PatternId): Partial<ZoneSpec['tile']> {
  return p === 'hex' ? { width: 200, height: 200 } : p === 'octo' ? { width: 250, height: 250 } : {};
}
