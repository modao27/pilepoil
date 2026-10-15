/** Écran d'un module pour un chemin sous #/p/:id/m/<module>/ (docs/BOITE.md §8). */
import type { ModuleRoute, ModuleScreens, ScreenLoader } from '../../modules/types';

export interface ScreenMatch {
  load: ScreenLoader;
  params: Record<string, string>;
}

/** Écrans standard (éditeur) puis écrans propres au module ; null si aucun. */
export function matchScreen(screens: ModuleScreens, path: string): ScreenMatch | null {
  const routes: ModuleRoute[] = [{ path: '', load: screens.editor }, ...(screens.routes ?? [])];
  const parts = path.split('/').filter(Boolean);
  for (const r of routes) {
    const pattern = r.path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = pattern.every((p, i) => {
      if (p.startsWith(':')) params[p.slice(1)] = parts[i]!;
      return p.startsWith(':') || p === parts[i];
    });
    if (ok) return { load: r.load, params };
  }
  return null;
}
