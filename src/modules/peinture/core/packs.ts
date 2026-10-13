/**
 * Choix des pots (docs/peinture/SPEC.md §3.5) : combinaison de contenances qui couvre le besoin, au coût minimal,
 * puis au surplus minimal, puis au moins de pots, puis avec les plus grands pots. Pur, entiers (mL ou g).
 */
import type { PackCount, PaintPack } from './types';

export interface PackChoice {
  packs: PackCount[];
  /** Total acheté, mL (g). */
  purchased: number;
  cost: number | null;
}

interface State {
  cost: number;
  count: number;
  /** Nombre de pots par taille, du plus grand au plus petit. */
  n: Int32Array;
}

const toUnit = (size: number) => Math.round(size * 1000);

/** a vaut-il mieux que b à volume égal : coût, nombre de pots, puis plus grands pots. */
function better(a: State, b: State): boolean {
  if (a.cost !== b.cost) return a.cost < b.cost;
  if (a.count !== b.count) return a.count < b.count;
  for (let i = 0; i < a.n.length; i++) if (a.n[i] !== b.n[i]) return a.n[i]! > b.n[i]!;
  return false;
}

/** null si aucun conditionnement utilisable ou besoin invalide. */
export function choosePacks(need: number, packs: readonly PaintPack[]): PackChoice | null {
  if (!(need > 0) || !Number.isFinite(need)) return null;
  const bySize = new Map<number, PaintPack>();
  for (const p of packs) {
    const u = toUnit(p.size);
    if (u <= 0) continue;
    const old = bySize.get(u);
    // même contenance en double : le moins cher gagne
    if (!old || (p.price != null && (old.price == null || p.price < old.price))) bySize.set(u, p);
  }
  const sizes = [...bySize.keys()].sort((a, b) => b - a);
  if (!sizes.length) return null;
  // un conditionnement sans prix retire le critère de coût
  const priced = sizes.every((u) => bySize.get(u)!.price != null);
  const price = (u: number) => (priced ? bySize.get(u)!.price! : 0);

  const target = Math.ceil(need - 1e-6);
  // au-delà de target + plus grand pot − 1, retirer un pot garderait le besoin couvert pour un coût égal ou moindre
  const top = target + sizes[0]! - 1;
  const best: (State | undefined)[] = new Array<State | undefined>(top + 1);
  best[0] = { cost: 0, count: 0, n: new Int32Array(sizes.length) };
  for (let v = 1; v <= top; v++) {
    for (let i = 0; i < sizes.length; i++) {
      const prev = best[v - sizes[i]!];
      if (!prev) continue;
      const n = Int32Array.from(prev.n);
      n[i]!++;
      const cand: State = { cost: Math.round((prev.cost + price(sizes[i]!)) * 100) / 100, count: prev.count + 1, n };
      const cur = best[v];
      if (!cur || better(cand, cur)) best[v] = cand;
    }
  }
  // coût strictement moindre pour passer à un volume plus grand : à coût égal, le plus petit surplus gagne
  let pick: { v: number; s: State } | null = null;
  for (let v = target; v <= top; v++) {
    const s = best[v];
    if (s && (!pick || s.cost < pick.s.cost)) pick = { v, s };
  }
  if (!pick) return null;
  return {
    packs: sizes
      .map((u, i) => ({ size: u / 1000, count: pick!.s.n[i]!, price: bySize.get(u)!.price }))
      .filter((c) => c.count > 0),
    purchased: pick.v,
    cost: priced ? pick.s.cost : null,
  };
}
