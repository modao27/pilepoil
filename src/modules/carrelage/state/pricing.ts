import type { ProjectResult, ShoppingItem } from '../core';
import type { Tile } from './model';
import type { CarrelageData, CarrelageProject } from './data';

/**
 * Prix unitaire d'un article : prix saisi dans le projet, sinon prix au m² du carreau de la bibliothèque
 * (articles carreaux). undefined si inconnu.
 */
export function itemPrice(
  item: ShoppingItem,
  project: Pick<CarrelageData, 'prices' | 'surfaces'>,
  tiles: ReadonlyMap<string, Tile>,
  result: ProjectResult,
): number | undefined {
  const own = project.prices[item.key];
  if (own != null && own > 0) return own;
  if (item.kind !== 'tile') return undefined;
  const ref = result.plan.groups[item.group]?.zones[0];
  const zone = ref && project.surfaces[ref.surface]?.zones[ref.zone];
  const price = zone ? tiles.get(zone.tileId)?.pricePerM2 : undefined;
  return price != null && price > 0 ? price : undefined;
}

/** Coût total estimé et nombre d'articles sans prix. */
export function projectCost(
  project: CarrelageProject,
  tiles: readonly Tile[],
  result: ProjectResult,
): { total: number; unpriced: number } {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  let total = 0,
    unpriced = 0;
  for (const it of result.shopping) {
    const p = itemPrice(it, project, byId, result);
    if (p == null) unpriced++;
    else total += p * it.mult;
  }
  return { total, unpriced };
}

/** Surface carrelée totale en m² (dimensions des surfaces). */
export function projectArea(project: CarrelageProject): number {
  return project.surfaces.reduce((t, s) => t + (s.width * s.height) / 1e6, 0);
}
