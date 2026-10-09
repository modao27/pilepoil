import { libraries, modules } from '../../modules/registry';

/** Routes de l'application, par hash (#/…) : le bouton retour du téléphone fonctionne naturellement. */
export type Route =
  | { name: 'home' }
  /** Nouveau projet : choix de l'outil ; avec `module`, l'assistant de cet outil (#/new/<module>). */
  | { name: 'new'; module?: string }
  /** Bibliothèque de produits (#/library/<id>) et un de ses éléments (id null : nouveau). */
  | { name: 'library'; lib: string }
  | { name: 'libraryItem'; lib: string; id: string | null }
  | { name: 'settings' }
  | { name: 'demo' }
  /** Écran Projet : plan, outils activés, ajout d'un outil. */
  | { name: 'project'; id: string }
  /** Éditeur du plan commun. */
  | { name: 'plan'; id: string }
  /** Liste d'achat consolidée du projet. */
  | { name: 'shopping'; id: string }
  /** Écran d'un module : #/p/:id/m/:module/…path ; path vide = éditeur du module. */
  | { name: 'module'; id: string; module: string; path: string }
  /** Ancienne adresse : remplacée par `to` sans nouvelle entrée d'historique. */
  | { name: 'redirect'; to: Route }
  | { name: 'notFound'; path: string };

const libraryIds = libraries.map((l) => l.id);
const moduleIds = modules.map((m) => m.id);
const DEFAULT_LIBRARY = libraryIds[0]!;
const item = (lib: string, id: string): Route => ({ name: 'libraryItem', lib, id: id === 'new' ? null : id });

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d] = parts;
  if (!a) return { name: 'home' };
  if (a === 'new') {
    if (!b) return { name: 'new' };
    return !c && moduleIds.includes(b) ? { name: 'new', module: b } : { name: 'notFound', path };
  }
  if (a === 'library') {
    // #/library : la première bibliothèque
    if (!b) return { name: 'redirect', to: { name: 'library', lib: DEFAULT_LIBRARY } };
    if (!libraryIds.includes(b)) return { name: 'notFound', path };
    if (!c) return { name: 'library', lib: b };
    if (!d) return item(b, c);
  }
  if (a === 'settings' && !b) return { name: 'settings' };
  if (a === 'demo' && !b) return { name: 'demo' };
  if (a === 'p' && b && c === 'm' && d) return { name: 'module', id: b, module: d, path: parts.slice(4).join('/') };
  if (a === 'p' && b && !c) return { name: 'project', id: b };
  if (a === 'p' && b && c === 'plan' && !d) return { name: 'plan', id: b };
  if (a === 'p' && b && c === 'achats' && !d) return { name: 'shopping', id: b };
  return { name: 'notFound', path };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'new':
      return r.module ? '#/new/' + encodeURIComponent(r.module) : '#/new';
    case 'library':
      return '#/library/' + encodeURIComponent(r.lib);
    case 'libraryItem':
      return '#/library/' + encodeURIComponent(r.lib) + '/' + (r.id == null ? 'new' : encodeURIComponent(r.id));
    case 'settings':
      return '#/settings';
    case 'demo':
      return '#/demo';
    case 'project':
      return '#/p/' + encodeURIComponent(r.id);
    case 'plan':
      return '#/p/' + encodeURIComponent(r.id) + '/plan';
    case 'shopping':
      return '#/p/' + encodeURIComponent(r.id) + '/achats';
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
