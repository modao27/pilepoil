# Redirection de l'ancienne adresse

Contenu du dépôt `calepinage-pwa`, recréé après le renommage du dépôt de l'application en `pilepoil`
(GitHub ne redirige pas les sites Pages). Publié tel quel sur GitHub Pages (branche `main`, racine).

- `index.html`, `404.html` : redirigent vers https://modao27.github.io/pilepoil/ en gardant le chemin `#/…`.
- `sw.js` : remplace le service worker de l'ancienne appli installée ; il vide ses caches (et seulement les
  siens), se désinstalle et recharge, ce qui mène à la redirection.

Les projets ne sont pas dans ce site : ils sont dans le navigateur (base IndexedDB `calepinage`, même origine
`modao27.github.io`) et Pilepoil les copie une fois à son premier lancement. Voir docs/DEPLOY.md.
