import type { ColorMix, Orientation, PatternId, ProjectSpec, SurfaceSpec } from '../../src/core/types';
import type { LegacyProject, LegacySurface } from './legacyTypes';

const MIX: Record<string, ColorMix> = { uni: 'solid', alt: 'alternate', rand: 'random' };

/**
 * Convertit un projet legacy normalisé (sortie de `normSurface`) en entrée du moteur.
 * Les réglages globaux viennent de la surface active, comme dans legacy.
 * Conversions cm → mm faites par une seule multiplication, comme legacy.
 */
export function fromLegacy(p: LegacyProject): ProjectSpec {
  const act = p.surfaces[p.active]!;
  const room = p.room;
  return {
    surfaces: p.surfaces.map((s) => surfaceFromLegacy(s, act.orient)),
    settings: { margin: act.margin, reuseOffcuts: act.reuse, kerf: act.kerf, minOffcut: act.minr },
    room: room
      ? {
          length: room.L,
          width: room.l,
          walls: {
            ...(room.surf.A != null ? { A: room.surf.A } : {}),
            ...(room.surf.B != null ? { B: room.surf.B } : {}),
            ...(room.surf.C != null ? { C: room.surf.C } : {}),
            ...(room.surf.D != null ? { D: room.surf.D } : {}),
            ...(room.surf.F != null ? { floor: room.surf.F } : {}),
          },
        }
      : null,
  };
}

/** orient : sens global de legacy (réglage de la surface active), porté par chaque carreau. */
export function surfaceFromLegacy(s: LegacySurface, orient: Orientation): SurfaceSpec {
  return {
    kind: s.kind,
    width: s.W,
    height: s.H,
    joint: s.j,
    split: s.split,
    zones: s.zones.map((z) => ({
      size: z.unit === 'cm' ? z.size * 10 : z.size,
      unit: z.unit === 'cm' ? 'length' : z.unit,
      pattern: z.pattern as PatternId,
      tile: { width: z.a, height: z.b, thickness: z.th, color: z.c1, m2PerBox: z.box, orientation: orient },
      angle: z.angle,
      start: z.start,
      offsetX: z.dx,
      offsetY: z.dy,
      mix: MIX[z.mix] ?? 'random',
      colorB: z.c2,
      groutColor: z.grout,
    })),
    openings: s.res.map((r) => ({
      type: r.type,
      x: r.x,
      sill: r.sill,
      width: r.w,
      height: r.h,
      covered: r.cov,
      revealDepth: r.depth * 10,
      reveals: { ...r.rv },
      projection: r.proj,
    })),
    corners: s.folds.map((f) => ({ x: f.x, type: f.type, angle: f.ang, covered: f.cov })),
    plinth: { length: s.plinth.len, height: s.plinth.h, zone: s.plinth.zone },
    hiddenEdges: { ...s.hid },
    junctionsCovered: s.jcov,
  };
}
