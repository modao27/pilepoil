/** Routes de l'application, par hash (#/…) : le bouton retour du téléphone fonctionne naturellement. */
export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'library' }
  | { name: 'tile'; id: string | null }
  | { name: 'settings' }
  | { name: 'demo' }
  /** Écran d'un module : #/p/:id/m/:module/…path ; path vide = éditeur du module. */
  | { name: 'module'; id: string; module: string; path: string }
  /** Ancienne adresse : remplacée par `to` sans nouvelle entrée d'historique. */
  | { name: 'redirect'; to: Route }
  | { name: 'notFound'; path: string };

/** Module des projets d'avant la boîte à outils (anciennes adresses #/p/:id/…). */
const LEGACY_MODULE = 'carrelage';

const moduleRoute = (id: string, path: string): Route => ({ name: 'module', id, module: LEGACY_MODULE, path });

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d, e] = parts;
  if (!a) return { name: 'home' };
  if (a === 'new' && !b) return { name: 'new' };
  if (a === 'library' && !b) return { name: 'library' };
  if (a === 'library' && b && !c) return { name: 'tile', id: b === 'new' ? null : b };
  if (a === 'settings' && !b) return { name: 'settings' };
  if (a === 'demo' && !b) return { name: 'demo' };
  if (a === 'p' && b && c === 'm' && d) return { name: 'module', id: b, module: d, path: parts.slice(4).join('/') };
  // anciennes adresses du carrelage (favoris) ; en S1, #/p/:id ouvre le carrelage
  if (a === 'p' && b && !c) return { name: 'redirect', to: moduleRoute(b, '') };
  if (a === 'p' && b && (c === 'results' || c === 'room' || c === 'compare') && !d)
    return { name: 'redirect', to: moduleRoute(b, c) };
  if (a === 'p' && b && c === 's' && d && !e) return { name: 'redirect', to: moduleRoute(b, 's/' + d) };
  return { name: 'notFound', path };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'new':
      return '#/new';
    case 'library':
      return '#/library';
    case 'tile':
      return '#/library/' + (r.id == null ? 'new' : encodeURIComponent(r.id));
    case 'settings':
      return '#/settings';
    case 'demo':
      return '#/demo';
    case 'module':
      return (
        '#/p/' +
        encodeURIComponent(r.id) +
        '/m/' +
        encodeURIComponent(r.module) +
        r.path
          .split('/')
          .filter(Boolean)
          .map((s) => '/' + encodeURIComponent(s))
          .join('')
      );
    case 'redirect':
      return href(r.to);
    case 'notFound':
      return '#' + r.path;
  }
}
