import { EPS } from '../../../../core/constants';
import { pattern } from '../patterns/registry';
import type { RawPiece, SurfaceSpec, SurfaceWarning } from '../types';

/** Plinthes : segments de la longueur du carreau, bord d'usine en haut, coupe contre le sol. */
export function buildPlinth(
  s: SurfaceSpec,
  zoneBuilt: boolean[],
  pieces: RawPiece[],
  warnings: SurfaceWarning[],
): void {
  const pl = s.plinth;
  if (!(pl.length > 0 && pl.height > 0)) return;
  const zi = Math.min(Math.max(0, pl.zone | 0), s.zones.length - 1),
    z = s.zones[zi]!;
  if (pattern(z.pattern).shape !== 'rect') {
    warnings.push({ code: 'plinth-pattern' });
    return;
  }
  if (!zoneBuilt[zi]) return;
  const a = Math.max(z.tile.width, z.tile.height),
    b = Math.min(z.tile.width, z.tile.height);
  if (pl.height > b + EPS) {
    warnings.push({ code: 'plinth-too-high' });
    return;
  }
  const segs: number[] = [];
  for (let p = 0; p < pl.length - EPS; p += a + s.joint) segs.push(Math.min(a, pl.length - p));
  segs.forEach((sg, k) => {
    const full = sg >= a - EPS && pl.height >= b - EPS;
    pieces.push({
      zone: zi,
      parts: null,
      outline: [],
      vis: [],
      full,
      thin: !full && sg < Math.max(20, a / 4),
      atFold: false,
      drill: 0,
      notch: false,
      rect: true,
      img: null,
      pw: sg,
      ph: pl.height,
      fw: a,
      fh: b,
      minD: Math.min(sg, pl.height),
      req: { L: k > 0, R: k < segs.length - 1, T: true, B: false },
      par: 0,
      kind: 'main',
      shape: 'rect',
      tf: [
        [0, 0],
        [sg, 0],
        [sg, pl.height],
        [0, pl.height],
      ],
      tW: a,
      tH: b,
      tA: a * b,
      tpoly: null,
      pparts: null,
      reveal: null,
      plinth: true,
    });
  });
}
