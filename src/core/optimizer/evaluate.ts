import { buildZone } from '../cutting/buildZone';
import { planCuts } from '../cutting/planCuts';
import { layoutZones } from '../layout/zones';
import type { OptimizerGoal, Piece, RawPiece, Settings, SurfaceSpec, ZoneSpec } from '../types';

export interface ZoneScore {
  /** Carreaux nécessaires (entiers + entamés). */
  needed: number;
  thin: number;
  vis: number;
  /** Plus petite coupe ; Infinity sans coupe. */
  minD: number;
}

export type ZonePlacement = Pick<ZoneSpec, 'offsetX' | 'offsetY' | 'start'>;

/** Évalue une zone seule avec un autre départ [evalZone]. Les produits ne sont distingués que par forme. */
export function evaluateZone(s: SurfaceSpec, zi: number, over: Partial<ZonePlacement>, settings: Settings): ZoneScore {
  const lay = layoutZones(s),
    z = { ...s.zones[zi]!, ...over },
    raw: RawPiece[] = [];
  buildZone(s, z, zi, lay.rects[zi]!, raw);
  const list: Piece[] = raw.map((pc) => ({
    ...pc,
    surface: 0,
    key: pc.shape + (pc.shape === 'chevron' ? pc.par : '') + '|' + pc.kind,
    color: '#000',
    label: { shape: pc.shape, size: [0, 0] },
    m2PerBox: 0,
    orientation: z.tile.orientation,
  }));
  const plan = planCuts(list, settings);
  return {
    needed: plan.groups.reduce((t, g) => t + g.full + g.tiles.length, 0),
    thin: list.filter((p) => p.thin).length,
    vis: list.filter((p) => p.vis.length).length,
    minD: list.filter((p) => !p.full).reduce((m, p) => Math.min(m, p.minD), Infinity),
  };
}

/** Score à minimiser [scoreOf] ; « sym » est évalué comme « bal ». */
export function scoreOf(r: ZoneScore, goal: OptimizerGoal): number {
  const small = r.minD < Infinity ? Math.max(0, 60 - r.minD) / 60 : 0;
  if (goal === 'tiles') return r.needed * 100 + r.thin * 8 + r.vis * 8 + small;
  if (goal === 'bal' || goal === 'sym') return r.needed * 25 + r.thin * 30 + r.vis * 30 + small * 5;
  return r.thin * 100 + r.vis * 70 + r.needed + small * 10;
}
