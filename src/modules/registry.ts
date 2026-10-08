/** Modules de la boîte à outils, dans l'ordre d'affichage (docs/BOITE.md §2). */
import { module as carrelage } from './carrelage/index';
import type { ModuleId, ToolModuleS2 } from './types';

export const modules: readonly ToolModuleS2[] = [carrelage];

export function moduleById(id: ModuleId): ToolModuleS2 | undefined {
  return modules.find((m) => m.id === id);
}
