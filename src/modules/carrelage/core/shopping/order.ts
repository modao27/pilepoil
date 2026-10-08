import type { CutPlan, Piece, ProductGroup } from '../types';

export interface OrderLine {
  /** Posés : entiers + pièces coupées. */
  posed: number;
  /** Nécessaires : entiers + carreaux entamés pour les coupes. */
  needed: number;
  /** À commander, marge comprise. */
  order: number;
  /** m² commandés (à la pièce). */
  m2: number;
  /** Cartons ; 0 si vendu à la pièce. */
  boxes: number;
  /** m² achetés : cartons entiers, ou m² à la pièce. */
  buyM2: number;
}

/** Quantités d'un produit : nécessaires, à commander = ⌈nécessaires × (1 + marge)⌉, cartons. */
export function orderLine(g: ProductGroup, margin: number): OrderLine {
  const needed = g.full + g.tiles.length,
    order = Math.ceil(needed * (1 + margin / 100)),
    m2 = (order * g.tileArea) / 1e6;
  const boxes = g.m2PerBox > 0 ? Math.ceil(m2 / g.m2PerBox - 1e-9) : 0;
  return { posed: g.full + g.cuts.length, needed, order, m2, boxes, buyM2: boxes ? boxes * g.m2PerBox : m2 };
}

export interface Metrics {
  posed: number;
  needed: number;
  order: number;
  m2: number;
  boxes: number;
  cuts: number;
  thin: number;
  /** Pièces avec une coupe apparente. */
  vis: number;
  reused: number;
  /** Plus petite dimension coupée ; 0 sans coupe. */
  minCut: number;
}

/** Résumé du projet [metrics]. */
export function metrics(pieces: Piece[], plan: CutPlan, margin: number): Metrics {
  let posed = 0,
    needed = 0,
    order = 0,
    m2 = 0,
    boxes = 0;
  for (const g of plan.groups) {
    const o = orderLine(g, margin);
    posed += o.posed;
    needed += o.needed;
    order += o.order;
    m2 += o.m2;
    boxes += o.boxes;
  }
  const cuts = pieces.filter((p) => !p.full);
  return {
    posed,
    needed,
    order,
    m2,
    boxes,
    cuts: cuts.length,
    thin: pieces.filter((p) => p.thin).length,
    vis: pieces.filter((p) => p.vis.length).length,
    reused: pieces.filter((p, i) => !p.full && plan.reused[i]).length,
    minCut: cuts.length ? Math.min(...cuts.map((p) => p.minD)) : 0,
  };
}
