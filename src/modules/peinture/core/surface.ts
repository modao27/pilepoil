/**
 * Surfaces d'une pose de peinture (docs/peinture/SPEC.md §3.1 et §3.4) : aire brute, ouvertures déduites,
 * plinthes, huisseries et vantaux. Repère du mur (x le long du mur, y depuis le sol vers le haut). Pur, mm / mm².
 */
import { intersection, difference, regionArea, union } from '../../../core/geometry/boolean';
import type { Polygon } from '../../../core/geometry/types';
import type { OpeningRule, SpecOpening, SpecSkirting, SpecZone, WoodworkSettings } from './types';

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
  /** Bande des plinthes retirée (hors ouvertures déjà retirées). */
  skirting: number;
  /** Des ouvertures retenues se recouvrent. */
  overlap: boolean;
}

/**
 * Plinthes d'une zone : celles lues des autres revêtements, sinon (sol non revêtu dans l'application) le réglage
 * manuel des boiseries s'il est coché, au pied de la zone moins les portes.
 */
export function zoneSkirtings(z: SpecZone, w: Pick<WoodworkSettings, 'skirting' | 'skirtingHeight'>): SpecSkirting[] {
  if (z.skirtings) return z.skirtings;
  if (!w.skirting) return [];
  return floorRuns(z).map(([from, to]) => ({ from, to, height: w.skirtingHeight, paintable: true }));
}

export function measureZone(z: SpecZone, rule: OpeningRule, skirtings: readonly SpecSkirting[] = []): ZoneMeasure {
  const gross = area(z.region);
  const kept = z.openings.filter((o) => deducted(o, rule));
  const all = kept.reduce<Polygon[]>((acc, o) => union(acc, openingRegion(o)), []);
  const inside = kept.length && gross > 0 ? area(intersection(z.region, all)) : 0;
  const sum = kept.reduce((s, o) => s + area(intersection(z.region, openingRegion(o))), 0);
  const band = skirtings.reduce<Polygon[]>((acc, k) => union(acc, rectRegion(k.from, 0, k.to, k.height)), []);
  const hidden = band.length && gross > 0 ? intersection(z.region, band) : [];
  const skirting = hidden.length ? area(all.length ? difference(hidden, all) : hidden) : 0;
  return { gross, openings: inside, skirting, overlap: sum - inside > 1 };
}

/** Ouvertures du mur qui touchent la zone (recouvrement non nul). */
export function openingsIn(z: SpecZone): SpecOpening[] {
  return z.openings.filter((o) => area(intersection(z.region, openingRegion(o))) > 0);
}

/** Pied de la zone, moins les ouvertures au sol (portes) : intervalles le long du mur, mm. */
function floorRuns(z: SpecZone): [number, number][] {
  let r = intersection(z.region, rectRegion(-1, 0, 1e7, 1));
  for (const o of z.openings.filter((x) => x.sill === 0)) r = difference(r, openingRegion(o));
  return r
    .map((p): [number, number] => [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0]))])
    .filter(([a, b]) => b - a > 0.5)
    .sort((a, b) => a[0] - b[0]);
}

/** Longueur de plinthe à peindre au pied de la zone (plinthes peignables seulement, portes retirées), mm. */
export function paintableSkirting(z: SpecZone, skirtings: readonly SpecSkirting[]): { length: number; area: number } {
  let length = 0,
    surface = 0;
  for (const k of skirtings.filter((x) => x.paintable)) {
    let r = intersection(z.region, rectRegion(k.from, 0, k.to, 1));
    for (const o of z.openings.filter((x) => x.sill === 0)) r = difference(r, openingRegion(o));
    const l = area(r);
    length += l;
    surface += l * k.height;
  }
  return { length, area: surface };
}

/** Périmètre peint de l'huisserie : porte sans seuil, fenêtre sur ses quatre côtés, mm. */
export const framePerimeter = (o: SpecOpening): number =>
  o.kind === 'door' ? 2 * o.height + o.width : 2 * (o.width + o.height);
