import type { ResultScope } from '../../core/coverage/scope';
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
  /** Fiche produit envoyée par le favori « Envoyer à PilePoil » (#/import/<texte>), ou à coller (#/import). */
  | { name: 'import'; text: string }
  | { name: 'demo' }
  /** Écran Projet : plan, outils activés, ajout d'un outil. */
  | { name: 'project'; id: string }
  /** Éditeur du plan commun. */
  | { name: 'plan'; id: string }
  /** Vue 3D du projet : maquette de toutes les pièces (docs/NAVIGATION.md §3). */
  | { name: 'model3d'; id: string }
  /** Écran Pièce : sol et murs, zones et poses ; `surface` : 'sol' ou identifiant d'un mur sélectionné. */
  | { name: 'room'; id: string; room: string; surface?: string }
  /** Résultats d'une pose, d'une pièce ou du projet, avec export (docs/NAVIGATION.md §7). */
  | { name: 'results'; id: string; scope: ResultScope }
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
const results = (id: string, scope: ResultScope): Route => ({ name: 'results', id, scope });
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
  if (a === 'import') return { name: 'import', text: parts.slice(1).join('/') };
  if (a === 'demo' && !b) return { name: 'demo' };
  if (a === 'p' && b && c === 'm' && d) {
    // ancienne adresse des résultats d'un outil : ceux du projet
    if (parts[4] === 'results' && parts.length === 5) return { name: 'redirect', to: results(b, { kind: 'project' }) };
    return { name: 'module', id: b, module: d, path: parts.slice(4).join('/') };
  }
  if (a === 'p' && b && c === 'resultats' && !d) return results(b, { kind: 'project' });
  if (a === 'p' && b && c === 'r' && d && parts[4] === 'resultats' && parts.length === 5)
    return results(b, { kind: 'room', room: d });
  if (a === 'p' && b && c === 'pose' && d && parts[4] === 'resultats' && parts.length === 5)
    return results(b, { kind: 'pose', pose: d });
  if (a === 'p' && b && !c) return { name: 'project', id: b };
  if (a === 'p' && b && c === 'plan' && !d) return { name: 'plan', id: b };
  if (a === 'p' && b && c === '3d' && !d) return { name: 'model3d', id: b };
  if (a === 'p' && b && c === 'r' && d && parts.length <= 5)
    return parts[4] ? { name: 'room', id: b, room: d, surface: parts[4] } : { name: 'room', id: b, room: d };
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
    case 'import':
      return '#/import' + (r.text ? '/' + encodeURIComponent(r.text) : '');
    case 'demo':
      return '#/demo';
    case 'project':
      return '#/p/' + encodeURIComponent(r.id);
    case 'plan':
      return '#/p/' + encodeURIComponent(r.id) + '/plan';
    case 'model3d':
      return '#/p/' + encodeURIComponent(r.id) + '/3d';
    case 'shopping':
      return '#/p/' + encodeURIComponent(r.id) + '/achats';
    case 'results': {
      const p = '#/p/' + encodeURIComponent(r.id);
      const s = r.scope;
      if (s.kind === 'project') return p + '/resultats';
      if (s.kind === 'room') return p + '/r/' + encodeURIComponent(s.room) + '/resultats';
      return p + '/pose/' + encodeURIComponent(s.pose) + '/resultats';
    }
    case 'room':
      return (
        '#/p/' +
        encodeURIComponent(r.id) +
        '/r/' +
        encodeURIComponent(r.room) +
        (r.surface ? '/' + encodeURIComponent(r.surface) : '')
      );
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
