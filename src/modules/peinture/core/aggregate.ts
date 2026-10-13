/**
 * Besoins du projet (docs/peinture/SPEC.md §5) : les besoins d'un même produit sur plusieurs poses s'additionnent
 * avant le choix des pots, pour acheter une seule combinaison. Pur.
 */
import { choosePacks } from './packs';
import type { PackCount, PaintRole, PaintSpec, PaintResult, SpecPaint } from './types';

export interface ProjectNeed {
  paint: SpecPaint;
  role: PaintRole;
  /** mL (g pour un enduit), toutes poses confondues. */
  need: number;
  /** m² traités. */
  surface: number;
  packs: PackCount[];
  purchased: number;
  /** null : un conditionnement n'a pas de prix, ou aucun conditionnement. */
  cost: number | null;
}

/** Un besoin par (produit, rôle), dans l'ordre d'apparition. */
export function projectNeeds(poses: readonly { spec: PaintSpec; result: PaintResult }[]): ProjectNeed[] {
  const sums = new Map<string, { paint: SpecPaint; role: PaintRole; need: number; surface: number }>();
  for (const { spec, result } of poses)
    for (const p of result.products) {
      const paint = spec.paints[p.paint];
      if (!paint) continue;
      const key = `${p.paint}:${p.role}`;
      const s = sums.get(key) ?? { paint, role: p.role, need: 0, surface: 0 };
      s.need += p.need;
      s.surface += p.surface;
      sums.set(key, s);
    }
  return [...sums.values()].map((s) => {
    const choice = choosePacks(s.need, s.paint.packs);
    return { ...s, packs: choice?.packs ?? [], purchased: choice?.purchased ?? 0, cost: choice?.cost ?? null };
  });
}
