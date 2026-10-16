/**
 * Besoins du projet (docs/peinture/SPEC.md §5) : les besoins d'un même produit dans une même teinte sur plusieurs
 * poses s'additionnent avant le choix des pots, pour acheter une seule combinaison ; deux teintes, deux achats. Pur.
 */
import { choosePacks } from './packs';
import type { PackCount, PaintColor, PaintResult, PaintRole, SpecPaint } from './types';

export interface ProjectNeed {
  paint: SpecPaint;
  role: PaintRole;
  /** Teinte choisie dans les poses ; absente : celle du produit. */
  color?: PaintColor;
  /** mL (g pour un enduit), toutes poses confondues. */
  need: number;
  /** m² traités. */
  surface: number;
  packs: PackCount[];
  purchased: number;
  /** null : un conditionnement n'a pas de prix, ou aucun conditionnement. */
  cost: number | null;
}

/** Un besoin par (produit, rôle, teinte), dans l'ordre d'apparition. */
export function projectNeeds(
  results: readonly PaintResult[],
  paints: Readonly<Record<string, SpecPaint>>,
): ProjectNeed[] {
  const sums = new Map<
    string,
    { paint: SpecPaint; role: PaintRole; color?: PaintColor; need: number; surface: number }
  >();
  for (const result of results)
    for (const p of result.products) {
      const paint = Object.hasOwn(paints, p.paint) ? paints[p.paint] : undefined;
      if (!paint) continue;
      const key = `${p.paint}:${p.role}:${p.color?.hex.toLowerCase() ?? ''}`;
      const s = sums.get(key) ?? { paint, role: p.role, ...(p.color ? { color: p.color } : {}), need: 0, surface: 0 };
      s.need += p.need;
      s.surface += p.surface;
      sums.set(key, s);
    }
  return [...sums.values()].map((s) => {
    const choice = choosePacks(s.need, s.paint.packs);
    return { ...s, packs: choice?.packs ?? [], purchased: choice?.purchased ?? 0, cost: choice?.cost ?? null };
  });
}
