/** Résumé d'un module pour sa carte sur l'écran Projet : entrée du moteur, calcul en file, résumé. */
import type { ModuleSummary, ToolModuleS2 } from '../../modules/types';
import type { Project } from '../../state/model';
import { app } from './app.svelte';

/** null : le module ne peut pas encore calculer (données à compléter). */
export async function moduleSummary(p: Project, m: ToolModuleS2): Promise<ModuleSummary | null> {
  const r = m.toSpec(p, app.libraries);
  if ('errors' in r) return null;
  return m.summary(await app.queued(m.id, r.spec));
}
