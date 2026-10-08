import type { CutTile, Orientation, Polygon, SideFlags } from '../types';

/** Réglages de découpe utiles au réemploi. */
export interface CutContext {
  orientation: Orientation;
  /** Perte par coupe. */
  kerf: number;
  /** Plus petite chute gardée. */
  minOffcut: number;
}

/** Chute rectangulaire ; f = côtés qui sont des bords d'usine. */
export interface RectStock {
  type: 'rect';
  w: number;
  h: number;
  area: number;
  f: SideFlags;
  tile: CutTile;
}

/** Chute polygonale (coupe biaise, formes non rectangulaires). */
export interface PolyStock {
  type: 'poly';
  poly: Polygon;
  area: number;
  tile: CutTile;
}

export type Stock = RectStock | PolyStock;

/** Quarts de tour permis : la face émaillée n'est jamais retournée. */
export function rotations(o: Orientation): number[] {
  return o === 'free' ? [0, 1, 2, 3] : o === '180' ? [0, 2] : [0];
}

/** Côtés requis après r quarts de tour. */
export function rotateReq(q: SideFlags, r: number): SideFlags {
  for (let i = 0; i < r; i++) q = { L: q.B, T: q.L, R: q.T, B: q.R };
  return q;
}
