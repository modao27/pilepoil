import { validateSurface } from '../cutting/buildSurface';
import { layoutZones } from '../layout/zones';
import { pattern } from '../patterns/registry';
import type { OptimizerGoal, Settings, SurfaceSpec } from '../types';
import { evaluateZone, scoreOf, type ZonePlacement, type ZoneScore } from './evaluate';

export interface OptimizeProgress {
  zone: number;
  /** Avancement de la zone en %, de 0 à 100. */
  percent: number;
}

export interface OptimizeResult {
  /** Nouveau départ par zone optimisée. */
  zones: ({ zone: number } & ZonePlacement)[];
  before: Pick<ZoneScore, 'needed' | 'thin' | 'vis'>;
  after: Pick<ZoneScore, 'needed' | 'thin' | 'vis'>;
}

/**
 * Recherche du meilleur départ pour des zones d'une surface [optimize] : grille sur une période du motif,
 * puis affinage autour du meilleur ; « sym » essaie les départs centrés carreau et joint.
 * Zones en rangées : axe d'empilement verrouillé.
 *
 * Générateur : rend la progression après chaque colonne ou ligne de recherche, pour que l'appelant
 * (worker) puisse l'afficher ou abandonner le calcul. La valeur de retour est le résultat.
 */
export function* optimizeZones(
  surface: SurfaceSpec,
  zones: number[],
  goal: OptimizerGoal,
  settings: Settings,
): Generator<OptimizeProgress, OptimizeResult, void> {
  const result: OptimizeResult = {
    zones: [],
    before: { needed: 0, thin: 0, vis: 0 },
    after: { needed: 0, thin: 0, vis: 0 },
  };
  const lay = layoutZones(surface);
  if (validateSurface(surface, lay)) return result;
  const s: SurfaceSpec = { ...surface, zones: surface.zones.slice() };
  const scoreGoal: OptimizerGoal = goal === 'sym' ? 'bal' : goal;

  for (const zi of zones) {
    const z = s.zones[zi],
      rc = lay.rects[zi];
    if (!z || !rc || rc.w < 1 || rc.h < 1) continue;
    const j = s.joint,
      a = z.tile.width,
      b = z.tile.height;
    const lockX = s.split === 'v' && z.unit === 'rows',
      lockY = s.split === 'h' && z.unit === 'rows';
    const base = evaluateZone(s, zi, {}, settings);
    const current: ZonePlacement = { offsetX: z.offsetX, offsetY: z.offsetY, start: z.start };
    let best: { over: ZonePlacement | null; r: ZoneScore | null; sc: number } = {
      over: current,
      r: base,
      sc: scoreOf(base, scoreGoal),
    };
    const tryC = (over: ZonePlacement) => {
      const r = evaluateZone(s, zi, over, settings),
        sc = scoreOf(r, scoreGoal);
      if (sc < best.sc - 1e-9) best = { over, r, sc };
    };

    if (goal === 'sym') {
      best = { over: null, r: null, sc: Infinity };
      if (!lockX && !lockY) {
        for (const start of ['tile', 'joint'] as const) tryC({ start, offsetX: 0, offsetY: 0 });
      } else if (z.angle === 0 || z.angle === 90) {
        const g = pattern(z.pattern).geo(a, b, j);
        for (const ref of [g.ctr, g.jn]) {
          const o: ZonePlacement = { start: 'corner', offsetX: z.offsetX, offsetY: z.offsetY },
            rx = ref[0] - g.tl[0],
            ry = ref[1] - g.tl[1];
          const ux = z.angle === 90 ? -ry : rx,
            uy = z.angle === 90 ? rx : ry;
          if (lockY) o.offsetX = Math.round(rc.w / 2 - ux);
          else o.offsetY = Math.round(rc.h / 2 - uy);
          tryC(o);
        }
      } else best = { over: current, r: base, sc: 0 };
      yield { zone: zi, percent: 100 };
    } else {
      let [Px, Py] = pattern(z.pattern).period(a, b, j);
      if (z.angle === 90) [Px, Py] = [Py, Px];
      else if (z.angle % 90) Px = Py = Math.max(Px, Py);
      const est = (rc.w * rc.h) / ((a + j) * (b + j)),
        N = est > 2500 ? 6 : est > 900 ? 9 : 12;
      const xs = lockX ? [z.offsetX] : Array.from({ length: N }, (_, k) => (k * Px) / N),
        ys = lockY ? [z.offsetY] : Array.from({ length: N }, (_, k) => (k * Py) / N);
      let cnt = 0;
      for (const dx of xs) {
        for (const dy of ys) {
          tryC({ start: z.start, offsetX: Math.round(dx), offsetY: Math.round(dy) });
          cnt++;
        }
        yield { zone: zi, percent: Math.round((cnt / (xs.length * ys.length)) * 70) };
      }
      const stX = lockX ? 0 : Px / N,
        stY = lockY ? 0 : Py / N,
        c0 = best.over!;
      for (let i = -3; i <= 3; i++) {
        for (let k = -3; k <= 3; k++) {
          if (!i && !k) continue;
          tryC({
            start: z.start,
            offsetX: Math.round(c0.offsetX + (i * stX) / 4),
            offsetY: Math.round(c0.offsetY + (k * stY) / 4),
          });
        }
        yield { zone: zi, percent: 70 + (i + 3) * 4 };
      }
    }

    if (best.over) {
      s.zones[zi] = { ...z, ...best.over };
      result.zones.push({ zone: zi, ...best.over });
    }
    const after = best.r ?? base;
    for (const k of ['needed', 'thin', 'vis'] as const) {
      result.before[k] += base[k];
      result.after[k] += after[k];
    }
  }
  return result;
}

/** Exécute l'optimisation jusqu'au bout (sans suivi de progression). */
export function optimizeZonesSync(
  surface: SurfaceSpec,
  zones: number[],
  goal: OptimizerGoal,
  settings: Settings,
): OptimizeResult {
  const it = optimizeZones(surface, zones, goal, settings);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
