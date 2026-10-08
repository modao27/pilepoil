/** Routes de l'application, par hash (#/…) : le bouton retour du téléphone fonctionne naturellement. */
export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'library' }
  | { name: 'tile'; id: string | null }
  | { name: 'settings' }
  | { name: 'demo' }
  | { name: 'project'; id: string; surfaceId: string | null }
  | { name: 'results'; id: string }
  | { name: 'room'; id: string }
  | { name: 'compare'; id: string }
  | { name: 'notFound'; path: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d] = parts;
  if (!a) return { name: 'home' };
  if (a === 'new' && !b) return { name: 'new' };
  if (a === 'library' && !b) return { name: 'library' };
  if (a === 'library' && b && !c) return { name: 'tile', id: b === 'new' ? null : b };
  if (a === 'settings' && !b) return { name: 'settings' };
  if (a === 'demo' && !b) return { name: 'demo' };
  if (a === 'p' && b && !c) return { name: 'project', id: b, surfaceId: null };
  if (a === 'p' && b && c === 'results' && !d) return { name: 'results', id: b };
  if (a === 'p' && b && c === 'room' && !d) return { name: 'room', id: b };
  if (a === 'p' && b && c === 'compare' && !d) return { name: 'compare', id: b };
  if (a === 'p' && b && c === 's' && d && parts.length === 4) return { name: 'project', id: b, surfaceId: d };
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
    case 'project':
      return '#/p/' + encodeURIComponent(r.id) + (r.surfaceId ? '/s/' + encodeURIComponent(r.surfaceId) : '');
    case 'results':
      return '#/p/' + encodeURIComponent(r.id) + '/results';
    case 'room':
      return '#/p/' + encodeURIComponent(r.id) + '/room';
    case 'compare':
      return '#/p/' + encodeURIComponent(r.id) + '/compare';
    case 'notFound':
      return '#' + r.path;
  }
}
