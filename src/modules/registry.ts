/** Modules de la boîte à outils, dans l'ordre d'affichage (docs/BOITE.md §2). */
import { module as carrelage } from './carrelage/index';
import { module as parquet } from './parquet/index';
import type { LibraryDefinition, ModuleId, ToolModule } from './types';

/** Outils proposés dans les projets. */
export const modules: readonly ToolModule[] = [carrelage, parquet];

export function moduleById(id: ModuleId): ToolModule | undefined {
  return modules.find((m) => m.id === id);
}

/** Bibliothèques de produits des modules, dans l'ordre des onglets. */
export const libraries: readonly LibraryDefinition[] = modules.flatMap((m) => (m.library ? [m.library] : []));

export function libraryById(id: string): LibraryDefinition | undefined {
  return libraries.find((l) => l.id === id);
}
