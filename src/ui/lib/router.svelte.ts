import { href, parseRoute, type Route } from './routes';

export const router = $state<{ route: Route }>({ route: { name: 'home' } });

/** Route de l'adresse ; une ancienne adresse est remplacée par la nouvelle (sans entrée d'historique). */
function resolve(hash: string): Route {
  const r = parseRoute(hash);
  if (r.name !== 'redirect') return r;
  history.replaceState(null, '', href(r.to));
  return r.to;
}

/** À appeler une fois au démarrage : suit le hash de l'adresse. */
export function startRouter(): void {
  const update = () => {
    router.route = resolve(location.hash);
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', update);
  router.route = resolve(location.hash);
}

/** Navigue vers une route ; replace : sans nouvelle entrée d'historique (après une création, par ex.). */
export function go(r: Route, replace = false): void {
  const h = href(r);
  if (replace) {
    history.replaceState(null, '', h);
    router.route = resolve(h);
  } else location.hash = h;
}
