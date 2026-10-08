import { href, parseRoute, type Route } from './routes';

export const router = $state<{ route: Route }>({ route: { name: 'home' } });

/** À appeler une fois au démarrage : suit le hash de l'adresse. */
export function startRouter(): void {
  const update = () => {
    router.route = parseRoute(location.hash);
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', update);
  router.route = parseRoute(location.hash);
}

/** Navigue vers une route ; replace : sans nouvelle entrée d'historique (après une création, par ex.). */
export function go(r: Route, replace = false): void {
  const h = href(r);
  if (replace) {
    history.replaceState(null, '', h);
    router.route = parseRoute(h);
  } else location.hash = h;
}
