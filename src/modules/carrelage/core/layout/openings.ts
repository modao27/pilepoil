import type { OpeningSpec, OpeningType } from '../types';

/** Rectangle d'ouverture dans le repère surface (y vers le bas). */
export interface OpeningRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  covered: boolean;
}

export function openingRect(o: OpeningSpec, surfaceHeight: number): OpeningRect {
  return {
    x0: o.x,
    x1: o.x + o.width,
    y0: surfaceHeight - o.sill - o.height,
    y1: surfaceHeight - o.sill,
    covered: o.covered,
  };
}

/** Les prises ne retirent pas de carrelage : la pièce est percée. */
export const isCutout = (o: OpeningSpec): boolean => o.type !== 'socket';

/** Fenêtres et portes ont des tableaux. */
export const hasReveal = (o: OpeningSpec): boolean => o.type === 'window' || o.type === 'door';

/** Dimensions par défaut d'une nouvelle ouverture, selon le type. */
export const OPENING_DEFAULTS: Record<
  OpeningType,
  { width: number; height: number; sill: number; projection?: number }
> = {
  window: { width: 1000, height: 1200, sill: 900 },
  door: { width: 830, height: 2040, sill: 0 },
  socket: { width: 80, height: 80, sill: 1100 },
  trap: { width: 300, height: 300, sill: 300 },
  tub: { width: 1700, height: 560, sill: 0, projection: 700 },
  other: { width: 500, height: 500, sill: 500 },
};

/**
 * Ouvertures qui retirent du carrelage, dans le repère d'une zone, limitées à celles qui la touchent.
 * Calcul fait comme legacy (x − rc.x après coup) pour garder les mêmes arrondis.
 */
export function zoneCutouts(
  openings: OpeningSpec[],
  surfaceHeight: number,
  rc: { x: number; y: number; w: number; h: number },
): OpeningRect[] {
  return openings
    .filter(isCutout)
    .map((o) => ({
      x0: o.x - rc.x,
      x1: o.x + o.width - rc.x,
      y0: surfaceHeight - o.sill - o.height - rc.y,
      y1: surfaceHeight - o.sill - rc.y,
      covered: o.covered,
    }))
    .filter((r) => r.x1 > 0 && r.x0 < rc.w && r.y1 > 0 && r.y0 < rc.h);
}
