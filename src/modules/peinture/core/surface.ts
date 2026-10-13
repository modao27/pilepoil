/**
 * Surfaces d'une pose de peinture (docs/peinture/SPEC.md §3.1 et §3.4) : aire brute, ouvertures déduites,
 * plinthes, huisseries et vantaux. Repère du mur (x le long du mur, y depuis le sol vers le haut). Pur, mm / mm².
 */
import { intersection, difference, regionArea, union } from '../../../core/geometry/boolean';
import type { Polygon } from '../../../core/geometry/types';
import type { OpeningRule, SpecOpening, SpecZone } from './types';

/** Rectangle dans le même sens que `surfacePolygon` (core/coverage). */
export function rectRegion(x0: number, y0: number, x1: number, y1: number): Polygon[] {
  return [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  ];
}

const area = (r: Polygon[]) => Math.abs(regionArea(r));

export const openingRegion = (o: SpecOpening): Polygon[] =>
  rectRegion(o.offset, o.sill, o.offset + o.width, o.sill + o.height);

/** L'ouverture est-elle déduite selon le réglage ? Le test porte sur l'ouverture entière. */
export function deducted(o: SpecOpening, rule: OpeningRule): boolean {
  if (rule.mode === 'all') return true;
  if (rule.mode === 'none') return false;
  return o.width * o.height > rule.threshold;
}

export interface ZoneMeasure {
  gross: number;
  /** Ouvertures retirées, sans double compte. */
  openings: number;
  /** Des ouvertures retenues se recouvrent. */
  overlap: boolean;
}

export function measureZone(z: SpecZone, rule: OpeningRule): ZoneMeasure {
  const gross = area(z.region);
  const kept = z.openings.filter((o) => deducted(o, rule));
  if (!kept.length || gross <= 0) return { gross, openings: 0, overlap: false };
  const all = kept.reduce<Polygon[]>((acc, o) => union(acc, openingRegion(o)), []);
  const inside = area(intersection(z.region, all));
  const sum = kept.reduce((s, o) => s + area(intersection(z.region, openingRegion(o))), 0);
  return { gross, openings: inside, overlap: sum - inside > 1 };
}

/** Ouvertures du mur qui touchent la zone (recouvrement non nul). */
export function openingsIn(z: SpecZone): SpecOpening[] {
  return z.openings.filter((o) => area(intersection(z.region, openingRegion(o))) > 0);
}

/** Longueur de plinthe au pied de la zone, moins les ouvertures au sol (portes), mm. */
export function skirtingLength(z: SpecZone): number {
  const strip = rectRegion(-1, 0, 1e7, 1);
  let r = intersection(z.region, strip);
  const doors = z.openings.filter((o) => o.sill === 0).map(openingRegion);
  for (const d of doors) r = difference(r, d);
  return area(r);
}

/** Périmètre peint de l'huisserie : porte sans seuil, fenêtre sur ses quatre côtés, mm. */
export const framePerimeter = (o: SpecOpening): number =>
  o.kind === 'door' ? 2 * o.height + o.width : 2 * (o.width + o.height);
