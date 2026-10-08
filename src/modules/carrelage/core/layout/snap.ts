import { patternFrame } from '../cutting/buildZone';
import { bbox, inset } from '../../../../core/geometry/polygon';
import type { ZoneSpec } from '../types';

export interface SnapResult {
  offsetX: number;
  offsetY: number;
  /** Bord de zone (repère zone) sur lequel un bord de carreau s'est aimanté, pour l'afficher. */
  guideX: number | null;
  guideY: number | null;
}

/**
 * Aimante le décalage d'un motif : si un bord de carreau passe à moins de `tol` mm d'un bord de la zone,
 * le motif est déplacé pour qu'il tombe pile dessus (pas de coupe sur ce bord). Valable pour les poses
 * à 0° et 90° (bords de carreaux parallèles aux bords de zone) ; sinon le décalage est seulement arrondi au mm.
 */
export function snapOffset(
  z: ZoneSpec,
  rc: { w: number; h: number },
  joint: number,
  raw: { offsetX: number; offsetY: number },
  tol: number,
): SnapResult {
  const out: SnapResult = {
    offsetX: Math.round(raw.offsetX),
    offsetY: Math.round(raw.offsetY),
    guideX: null,
    guideY: null,
  };
  if (z.angle % 90 !== 0 || !(rc.w > 0 && rc.h > 0)) return out;
  const zz = { ...z, offsetX: raw.offsetX, offsetY: raw.offsetY };
  const { cells, toW } = patternFrame(zz, rc, joint);
  // Bords de carreaux classés par côté : un bord gauche ne s'aimante qu'au bord gauche de la zone, etc.
  const left: number[] = [],
    right: number[] = [],
    top: number[] = [],
    bottom: number[] = [];
  for (const cell of cells) {
    const t = joint > 0 ? inset(cell.p, joint / 2) : cell.p;
    if (t.length < 3) continue;
    const w = t.map((q) => toW(q[0], q[1]));
    const b = bbox(w);
    if (b[1] < -tol || b[0] > rc.w + tol || b[3] < -tol || b[2] > rc.h + tol) continue;
    const cx = (b[0] + b[1]) / 2,
      cy = (b[2] + b[3]) / 2;
    for (let i = 0; i < w.length; i++) {
      const A = w[i]!,
        B = w[(i + 1) % w.length]!;
      if (Math.abs(A[0] - B[0]) < 1e-6) (A[0] < cx ? left : right).push(A[0]);
      else if (Math.abs(A[1] - B[1]) < 1e-6) (A[1] < cy ? top : bottom).push(A[1]);
    }
  }
  const best = (pairs: [number[], number][]) => {
    let d = Infinity,
      target: number | null = null;
    for (const [vals, tg] of pairs) {
      for (const v of vals) {
        if (Math.abs(tg - v) < Math.abs(d)) {
          d = tg - v;
          target = tg;
        }
      }
    }
    return Math.abs(d) <= tol ? { d, target } : null;
  };
  const sx = best([
      [left, 0],
      [right, rc.w],
    ]),
    sy = best([
      [top, 0],
      [bottom, rc.h],
    ]);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  if (sx) {
    out.offsetX = r2(raw.offsetX + sx.d);
    out.guideX = sx.target;
  }
  if (sy) {
    out.offsetY = r2(raw.offsetY + sy.d);
    out.guideY = sy.target;
  }
  return out;
}
