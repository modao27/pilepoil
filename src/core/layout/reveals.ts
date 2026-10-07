import { EPS, SIDES } from '../constants';
import { pattern } from '../patterns/registry';
import type { Point, Polygon, RawPiece, Side, SurfaceSpec, SurfaceWarning } from '../types';
import { hasReveal } from './openings';
import type { ZoneLayout } from './zones';

/** Géométrie des tableaux pour le rendu. */
export interface RevealGeometry {
  opening: number;
  zone: number;
  /** Rectangle intérieur [x0, y0, x1, y1] (fond des tableaux). */
  inner: [number, number, number, number];
  sides: { side: Side; poly: Polygon }[];
}

const lerp = (P: Point, Q: Point, t: number): Point => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];

/**
 * Tableaux de fenêtre et de porte : bandes profondeur × longueur, carreau de la zone qui contient
 * le centre de l'ouverture. Bord d'usine sur l'arête avant si elle n'est pas recouverte d'un profilé.
 */
export function buildReveals(
  s: SurfaceSpec,
  lay: ZoneLayout,
  zoneBuilt: boolean[],
  pieces: RawPiece[],
  warnings: SurfaceWarning[],
): RevealGeometry[] {
  const reveals: RevealGeometry[] = [];
  s.openings.forEach((r, ri) => {
    const D = r.revealDepth;
    if (!(D > 0) || !hasReveal(r)) return;
    const cx = r.x + r.width / 2,
      cy = s.height - r.sill - r.height / 2;
    const zi = lay.rects.findIndex((q) => cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h);
    if (zi < 0 || !zoneBuilt[zi]) return;
    const z = s.zones[zi]!;
    if (pattern(z.pattern).shape !== 'rect') {
      warnings.push({ code: 'reveal-pattern', opening: ri });
      return;
    }
    const a = Math.max(z.tile.width, z.tile.height),
      b = Math.min(z.tile.width, z.tile.height),
      jj = s.joint;
    const x0 = r.x,
      x1 = r.x + r.width,
      y0 = s.height - r.sill - r.height,
      y1 = s.height - r.sill;
    const Dd = Math.min(D, 0.42 * Math.min(r.width, r.height));
    const ix0 = x0 + (r.reveals.L ? Dd : 0),
      ix1 = x1 - (r.reveals.R ? Dd : 0),
      iy0 = y0 + (r.reveals.T ? Dd : 0),
      iy1 = y1 - (r.reveals.B ? Dd : 0);
    const edges: Record<Side, [Point, Point, Point, Point]> = {
      L: [
        [x0, y1],
        [x0, y0],
        [ix0, iy1],
        [ix0, iy0],
      ],
      R: [
        [x1, y1],
        [x1, y0],
        [ix1, iy1],
        [ix1, iy0],
      ],
      T: [
        [x0, y0],
        [x1, y0],
        [ix0, iy0],
        [ix1, iy0],
      ],
      B: [
        [x0, y1],
        [x1, y1],
        [ix0, iy1],
        [ix1, iy1],
      ],
    };
    const rv: RevealGeometry = { opening: ri, zone: zi, inner: [ix0, iy0, ix1, iy1], sides: [] };
    for (const sd of SIDES) {
      if (!r.reveals[sd] || (r.type === 'door' && sd === 'B')) continue;
      const [O0, O1, I0, I1] = edges[sd];
      const len = sd === 'L' || sd === 'R' ? r.height : r.width;
      // Comme legacy : la profondeur est rapportée à D, pas à Dd.
      const map = (u: number, v: number): Point => {
        const t = u / len;
        return lerp(lerp(O0, O1, t), lerp(I0, I1, t), v / D);
      };
      rv.sides.push({ side: sd, poly: [O0, O1, I1, I0] });
      const segs: [number, number][] = [],
        rows: [number, number][] = [];
      for (let p = 0; p < len - EPS; p += a + jj) segs.push([p, Math.min(a, len - p)]);
      for (let p = 0; p < D - EPS; p += b + jj) rows.push([p, Math.min(b, D - p)]);
      rows.forEach(([v0, d], m) =>
        segs.forEach(([u0, sg], k) => {
          const full = sg >= a - EPS && d >= b - EPS;
          const q: Polygon = [map(u0, v0), map(u0 + sg, v0), map(u0 + sg, v0 + d), map(u0, v0 + d)];
          pieces.push({
            zone: zi,
            parts: [q],
            outline: q.map((P, i) => [P, q[(i + 1) % 4]!]),
            vis: [],
            full,
            thin: !full && Math.min(sg, d) < Math.max(20, b / 4),
            atFold: false,
            drill: 0,
            notch: false,
            rect: true,
            img: null,
            pw: sg,
            ph: d,
            fw: a,
            fh: b,
            minD: Math.min(sg, d),
            req: { L: k > 0, R: k < segs.length - 1, T: m > 0 || !r.covered, B: m < rows.length - 1 },
            par: 0,
            kind: 'main',
            shape: 'rect',
            tf: [
              [0, 0],
              [sg, 0],
              [sg, d],
              [0, d],
            ],
            tW: a,
            tH: b,
            tA: a * b,
            tpoly: null,
            pparts: null,
            reveal: { opening: ri, side: sd, u0, u1: u0 + sg, v0, v1: v0 + d },
            plinth: false,
          });
        }),
      );
    }
    reveals.push(rv);
  });
  return reveals;
}
