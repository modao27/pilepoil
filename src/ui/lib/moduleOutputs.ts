/** Sorties de chaque outil d'un projet pour la coquille : un seul calcul (en file) donne résumé et achats. */
import type { ShoppingLine } from '../../core/shopping/types';
import { modules } from '../../modules/registry';
import type { ModuleSummary, ToolModule } from '../../modules/types';
import type { Project } from '../../state/model';
import { app } from './app.svelte';
import { projectContext } from './projectContext';

export interface ModuleOutput {
  module: ToolModule;
  /** null : le module ne peut pas encore calculer (données à compléter). */
  summary: ModuleSummary | null;
  lines: ShoppingLine[];
}

/** Outils activés du projet, dans l'ordre du registre. */
export const activeModules = (p: Project): ToolModule[] => modules.filter((m) => Object.hasOwn(p.modules, m.id));

/** Sorties déjà calculées, par état du projet (version enregistrée) et des bibliothèques. */
const cache = new Map<string, ModuleOutput>();
const CACHE_MAX = 200;

export async function moduleOutput(p: Project, m: ToolModule): Promise<ModuleOutput> {
  const key = `${p.id}|${p.updatedAt}|${app.libraryVersion}|${m.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = m.toSpec(p, app.libraries, projectContext(p, app.libraries));
  if ('errors' in r) return { module: m, summary: null, lines: [] };
  const result = await app.queued(m.id, r.spec);
  const out: ModuleOutput = {
    module: m,
    summary: m.summary(result),
    lines: m.shopping(result, p.modules[m.id]!.data, app.libraries, p),
  };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

/**
 * Comme `moduleOutput`, mais quand le navigateur est libre : les chiffres des cartes et de la vue globale ne
 * retardent pas le premier affichage.
 */
export function deferredOutput(p: Project, m: ToolModule): Promise<ModuleOutput> {
  return new Promise((resolve, reject) => {
    const go = () => moduleOutput(p, m).then(resolve, reject);
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 50);
  });
}

export const projectOutputs = (p: Project): Promise<ModuleOutput[]> =>
  Promise.all(activeModules(p).map((m) => moduleOutput(p, m)));

/** Version différée de `projectOutputs` (accueil). */
export const deferredProjectOutputs = (p: Project): Promise<ModuleOutput[]> =>
  Promise.all(activeModules(p).map((m) => deferredOutput(p, m)));
