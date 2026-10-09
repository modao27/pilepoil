/**
 * Optimisation du départ (docs/parquet/SPEC.md §4.2.8) : décalages de départ × graines, note = perte + pénalités.
 * Générateur : rend la progression après chaque essai, pour que le worker l'affiche ou l'arrête. Le départ
 * actuel est le premier essai : le résultat n'est jamais moins bon. Pur et déterministe.
 */
import { signedArea } from '../../../core/geometry/polygon';
import type { Point } from '../../../core/geometry/types';
import { computeParquet } from './compute';
import { layingFrame, toFrame } from './frame';
import type { LayoutResult, LayoutSpec, ParquetSpec } from './types';

/** Avancement de 0 à 100 (forme de `Progress` du contrat de module, sans dépendre de la coquille). */
export interface Progress {
  percent: number;
}

export interface OptimizeSpec {
  spec: ParquetSpec;
  layoutId: string;
}

export interface OptimizeScore {
  boards: number;
  /** Perte, mm². */
  waste: number;
  /** Joints à moins du décalage mini à deux rangs d'écart. */
  aligned: number;
  /** Rangs d'un escalier (même décalage sur plus de 3 rangs). */
  stairs: number;
  /** Pièces sous 1,2 × coupe mini. */
  short: number;
  total: number;
}

export interface OptimizeResult {
  layoutId: string;
  offset: Point;
  seed: number;
  before: OptimizeScore;
  after: OptimizeScore;
  /** false : le départ actuel est déjà le meilleur. */
  improved: boolean;
}

/** Nombre de décalages de départ et de graines essayés (SPEC : 20 × 10). */
export const OFFSETS = 20;
export const SEEDS = 10;

export function* optimizeLayout(input: OptimizeSpec): Generator<Progress, OptimizeResult, void> {
  const { spec, layoutId } = input;
  const base = spec.layouts.find((l) => l.id === layoutId);
  const none: OptimizeScore = { boards: 0, waste: 0, aligned: 0, stairs: 0, short: 0, total: 0 };
  if (!base?.board) return { layoutId, offset: [0, 0], seed: 1, before: none, after: none, improved: false };

  // motifs : axe résolu une fois (proposition choisie → point), pour ne pas recalculer les propositions
  let axis = base.axis;
  if (typeof axis === 'string') {
    const kind = axis;
    const opts = computeParquet({ ...spec, layouts: [base] }).layouts[0]!.axisOptions ?? [];
    axis = (opts.find((o) => o.kind === kind) ?? opts[0])?.point ?? [0, 0];
  }
  const candidates = candidatesOf(base);
  const evaluate = (offset: Point, seed: number) => {
    const l = { ...base, axis, offset, seed };
    const r = computeParquet({ ...spec, layouts: [l] }, { axisOptions: false }).layouts[0]!;
    return scoreOf(r, l);
  };
  const before = evaluate(base.offset, base.seed);
  let best = { offset: base.offset, seed: base.seed, score: before };
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = evaluate(c.offset, c.seed);
    // strictement meilleur : à égalité, on garde le départ actuel (ou le premier trouvé)
    if (s.total < best.score.total - 1e-6) best = { ...c, score: s };
    yield { percent: Math.round(((i + 1) / candidates.length) * 100) };
  }
  const improved = best.score !== before;
  return { layoutId, offset: best.offset, seed: best.seed, before, after: best.score, improved };
}

/**
 * Essais : décalages répartis sur une période du motif dans le repère de pose (pose droite : en travers des
 * rangs, sur une largeur de lame ; décalage régulier : aussi le long des lames ; motifs : sur une longueur et
 * une largeur), puis graines si la lame a des longueurs mixtes.
 */
export function candidatesOf(l: LayoutSpec): { offset: Point; seed: number }[] {
  const b = l.board!;
  const L = Math.max(...b.lengths),
    W = b.width;
  const frame = layingFrame(l.referenceDirection, l.angle);
  const at = (du: number, dv: number): Point => {
    const x = l.offset[0] + frame.u[0] * du + frame.v[0] * dv,
      y = l.offset[1] + frame.u[1] * du + frame.v[1] * dv;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };
  const steps: [number, number][] = [];
  if (l.pattern.kind === 'herringbone' || l.pattern.kind === 'chevron')
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) steps.push([(i * L) / 5, (j * W) / 4]);
  else if (l.pattern.kind === 'regular-stagger')
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) steps.push([(i * L * l.pattern.step) / 5, (j * W) / 4]);
  else for (let j = 0; j < OFFSETS; j++) steps.push([0, (j * W) / OFFSETS]);
  // graines : tirage des longueurs mixtes, et en coupe perdue la longueur de la première pièce des rangs
  const drawn = (b.lengths.length > 1 && !!b.lengthMix) || l.pattern.kind === 'random-stagger';
  const seeds = drawn ? Array.from({ length: SEEDS }, (_, k) => l.seed + k) : [l.seed];
  const out: { offset: Point; seed: number }[] = [];
  for (const [du, dv] of steps)
    for (const seed of seeds) {
      if (!du && !dv && seed === l.seed) continue; // départ actuel : déjà évalué
      out.push({ offset: at(du, dv), seed });
    }
  return out;
}

/** Note d'une pose : perte en mm² plus des pénalités, chacune comptée en fraction de lame. */
export function scoreOf(r: LayoutResult, l: LayoutSpec): OptimizeScore {
  const b = l.board!;
  const boardArea = (len: number) => len * b.width;
  const waste =
    r.boards.reduce((t, x) => t + boardArea(x.length), 0) -
    r.pieces.reduce((t, p) => t + Math.abs(signedArea(p.polygon)), 0);
  const minCut = l.rules.minCutLength;
  const short = r.pieces.filter((p) => p.cutType !== 'full' && p.length < 1.2 * minCut).length;
  const { aligned, stairs } = r.pieces.some((p) => p.row != null) ? jointPenalties(r, l) : { aligned: 0, stairs: 0 };
  // une lame de plus coûte une lame ; une pénalité vaut un dixième de lame
  const unit = boardArea(Math.max(...b.lengths));
  const errors = r.errors.length ? 1e15 : 0;
  return {
    boards: r.boards.length,
    waste: Math.round(waste),
    aligned,
    stairs,
    short,
    total: errors + waste + 0.1 * unit * (aligned + stairs + short),
  };
}

/** Pose droite : joints alignés à deux rangs d'écart ; escaliers (même décalage sur plus de 3 rangs). */
function jointPenalties(r: LayoutResult, l: LayoutSpec): { aligned: number; stairs: number } {
  const frame = layingFrame(l.referenceDirection, l.angle);
  const rows = new Map<number, number[]>();
  for (const p of r.pieces) {
    if (p.row == null) continue;
    const u = Math.min(...p.polygon.map((q) => toFrame(frame, q)[0]));
    rows.set(p.row, [...(rows.get(p.row) ?? []), u]);
  }
  const idx = [...rows.keys()].sort((a, b) => a - b);
  // joints : débuts de pièces sauf le premier du rang
  const joints = new Map(
    idx.map((i) => [
      i,
      rows
        .get(i)!
        .sort((a, b) => a - b)
        .slice(1),
    ]),
  );
  let aligned = 0;
  for (const i of idx) {
    const two = joints.get(i + 2);
    if (!two) continue;
    for (const x of joints.get(i)!) if (two.some((y) => Math.abs(x - y) < l.rules.minJointOffset - 1e-6)) aligned++;
  }
  let stairs = 0;
  if (l.pattern.kind === 'random-stagger') {
    let run = 1;
    for (let k = 2; k < idx.length; k++) {
      const a = joints.get(idx[k - 2]!)![0],
        b = joints.get(idx[k - 1]!)![0],
        c = joints.get(idx[k]!)![0];
      const same = a != null && b != null && c != null && Math.abs(c - b - (b - a)) < 1;
      run = same ? run + 1 : 1;
      if (run >= 3) stairs++;
    }
  }
  return { aligned, stairs };
}
