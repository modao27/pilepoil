/** Sorties de chaque outil d'un projet pour la coquille : un seul calcul (en file) donne résumé et achats. */
import type { ShoppingLine } from '../../core/shopping/types';
import { modules } from '../../modules/registry';
import type { ModuleSummary, ToolModuleS2 } from '../../modules/types';
import type { Project } from '../../state/model';
import { app } from './app.svelte';

export interface ModuleOutput {
  module: ToolModuleS2;
  /** null : le module ne peut pas encore calculer (données à compléter). */
  summary: ModuleSummary | null;
  lines: ShoppingLine[];
}

/** Outils activés du projet, dans l'ordre du registre. */
export const activeModules = (p: Project): ToolModuleS2[] => modules.filter((m) => Object.hasOwn(p.modules, m.id));

export async function moduleOutput(p: Project, m: ToolModuleS2): Promise<ModuleOutput> {
  const r = m.toSpec(p, app.libraries);
  if ('errors' in r) return { module: m, summary: null, lines: [] };
  const result = await app.queued(m.id, r.spec);
  return { module: m, summary: m.summary(result), lines: m.shopping(result, p.modules[m.id]!.data, app.libraries) };
}

export const projectOutputs = (p: Project): Promise<ModuleOutput[]> =>
  Promise.all(activeModules(p).map((m) => moduleOutput(p, m)));
