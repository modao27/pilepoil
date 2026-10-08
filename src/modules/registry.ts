/** Modules de la boîte à outils, dans l'ordre d'affichage (docs/BOITE.md §2). */
import { module as carrelage } from './carrelage/index';
import { library as boards } from './parquet/index';
import type { LibraryDefinition, ModuleId, ToolModule } from './types';

/** Outils proposés dans les projets. */
export const modules: readonly ToolModule[] = [carrelage];

export function moduleById(id: ModuleId): ToolModule | undefined {
  return modules.find((m) => m.id === id);
}

/**
 * Bibliothèques de produits, dans l'ordre des onglets. Le parquet n'apporte encore que sa bibliothèque de
 * lames (son outil arrive en P1).
 */
export const libraries: readonly LibraryDefinition[] = [carrelage.library!, boards];

export function libraryById(id: string): LibraryDefinition | undefined {
  return libraries.find((l) => l.id === id);
}
