import { buildSurface, type SurfaceResult } from './cutting/buildSurface';
import { planCuts } from './cutting/planCuts';
import { surfaceGlue, type ZoneGlue } from './shopping/glue';
import { shoppingItems, type ShoppingItem } from './shopping/items';
import { metrics, orderLine, type Metrics, type OrderLine } from './shopping/order';
import type { CutPlan, Piece, ProjectSpec } from './types';

export interface ProjectResult {
  /** Résultat par surface (pièces ou erreur). */
  surfaces: SurfaceResult[];
  /** Pièces de toutes les surfaces calculables, dans l'ordre du projet. */
  pieces: Piece[];
  plan: CutPlan;
  /** Quantités par produit, dans l'ordre de plan.groups. */
  orders: OrderLine[];
  metrics: Metrics;
  glue: ZoneGlue[];
  shopping: ShoppingItem[];
}

/**
 * Calcule tout le projet : pièces de chaque surface, plan de découpe partagé, quantités, encollage, achats.
 * Une surface en erreur est ignorée dans les totaux (son erreur est dans `surfaces`).
 */
export function computeProject(project: ProjectSpec): ProjectResult {
  const margin = project.settings.margin;
  const surfaces = project.surfaces.map((s, i) => buildSurface(s, i));
  const pieces: Piece[] = [];
  const glue: ZoneGlue[] = [];
  surfaces.forEach((r, i) => {
    if (!r.ok) return;
    pieces.push(...r.value.pieces);
    glue.push(...surfaceGlue(project.surfaces[i]!, i, r.value.pieces, margin));
  });
  const plan = planCuts(pieces, project.settings);
  return {
    surfaces,
    pieces,
    plan,
    orders: plan.groups.map((g) => orderLine(g, margin)),
    metrics: metrics(pieces, plan, margin),
    glue,
    shopping: shoppingItems(project, plan.groups, glue),
  };
}
