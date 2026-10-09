/**
 * Quantités des accessoires (docs/parquet/SPEC.md §4.6) : sous-couche, pare-vapeur, plinthes, seuils, colle ou
 * fixations. Lit le résultat du moteur ; pur, mm et m².
 */
import { regionArea } from '../../../core/geometry/boolean';
import { signedArea } from '../../../core/geometry/polygon';
import type { Polygon } from '../../../core/geometry/types';
import { fixingFor } from './defaults';
import type { Accessories, LayingMethod, ParquetResult } from './types';

export type AccessoryNeed =
  | { kind: 'underlay'; rolls: number; area: number; m2PerRoll: number; overlap: number }
  | { kind: 'vapor-barrier'; rolls: number; area: number; m2PerRoll: number }
  | { kind: 'skirting'; bars: number; length: number; barLength: number }
  | { kind: 'threshold'; bars: number; count: number; barLength: number }
  | { kind: 'glue'; units: number; area: number; m2PerUnit: number }
  | { kind: 'fixings'; units: number; area: number; perM2: number };

const EPS = 1e-9;
const up = (v: number) => Math.ceil(v - EPS);
const m2 = (rings: Polygon[]) => regionArea(rings) / 1e6;

/** Périmètre des contours extérieurs, mm. */
function perimeter(rings: Polygon[]): number {
  return rings
    .filter((r) => signedArea(r) > 0)
    .reduce((t, r) => t + r.reduce((s, p, i) => s + Math.hypot(...sub(r[(i + 1) % r.length]!, p)), 0), 0);
}
const sub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]];

/** Seuil posé et ses barres : chacune coupée à la largeur du passage (barres entières si plus large). */
export interface ThresholdCut {
  passage: string | null;
  /** Largeur du seuil, mm. */
  length: number;
  /** Longueur coupée dans chaque barre et reste. */
  bars: { length: number; rest: number }[];
}

export function thresholdCuts(r: ParquetResult, barLength: number): ThresholdCut[] {
  if (!(barLength > 0)) return [];
  return r.layouts
    .flatMap((l) => l.thresholds.filter((t) => t.status === 'applied'))
    .map((t) => {
      const length = Math.round(Math.hypot(t.segment[1][0] - t.segment[0][0], t.segment[1][1] - t.segment[0][1]));
      const bars: ThresholdCut['bars'] = [];
      for (let left = length; left > EPS; left -= barLength) {
        const cut = Math.min(left, barLength);
        bars.push({ length: cut, rest: barLength - cut });
      }
      return { passage: t.passage, length, bars };
    });
}

/**
 * @param methods mode de pose de chaque pose (par identifiant) : colle ou fixations selon la pose.
 */
export function accessoryNeeds(
  r: ParquetResult,
  methods: Record<string, LayingMethod>,
  acc: Accessories,
): AccessoryNeed[] {
  const out: AccessoryNeed[] = [];
  const area = r.totals.area;
  const byMethod = (m: LayingMethod) =>
    r.layouts.filter((l) => methods[l.id] === m).reduce((t, l) => t + m2(l.layable), 0);

  // sous-couche : pose flottante seulement
  const floating = byMethod('floating');
  if (acc.underlay.enabled && floating > 0)
    out.push({
      kind: 'underlay',
      rolls: up((floating * (1 + acc.underlay.overlap)) / acc.underlay.m2PerRoll),
      area: floating,
      m2PerRoll: acc.underlay.m2PerRoll,
      overlap: acc.underlay.overlap,
    });

  if (acc.vaporBarrier.enabled && area > 0) {
    const v = acc.vaporBarrier;
    const upstand = (r.layouts.reduce((t, l) => t + perimeter(l.layable), 0) * v.upstand) / 1e6;
    const total = area * (1 + v.overlap) + upstand;
    out.push({ kind: 'vapor-barrier', rolls: up(total / v.m2PerRoll), area: total, m2PerRoll: v.m2PerRoll });
  }

  if (acc.skirting.enabled && r.skirting.bars > 0)
    out.push({
      kind: 'skirting',
      bars: r.skirting.bars,
      length: r.skirting.pieces.reduce((t, p) => t + p.length, 0),
      barLength: acc.skirting.barLength,
    });

  // seuils posés : une barre par seuil, plus si le seuil est plus large qu'une barre
  const cuts = thresholdCuts(r, acc.thresholds.barLength);
  if (cuts.length)
    out.push({
      kind: 'threshold',
      count: cuts.length,
      bars: cuts.reduce((t, c) => t + c.bars.length, 0),
      barLength: acc.thresholds.barLength,
    });

  const glued = byMethod('glued');
  const glue = acc.glue ?? fixingFor('glued').glue!;
  if (glued > 0) out.push({ kind: 'glue', units: up(glued / glue.m2PerUnit), area: glued, m2PerUnit: glue.m2PerUnit });

  const nailed = byMethod('nailed');
  const fix = acc.fixings ?? fixingFor('nailed').fixings!;
  if (nailed > 0) out.push({ kind: 'fixings', units: up(nailed * fix.perM2), area: nailed, perM2: fix.perM2 });
  return out;
}
