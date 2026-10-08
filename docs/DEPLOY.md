# Mise en ligne

L'application est un site **statique** : le dossier `dist/` produit par `npm run build` suffit. Aucun serveur
applicatif, aucune base de données : les projets restent dans le navigateur de chaque utilisateur (IndexedDB).

## Exigences de l'hébergeur
- **HTTPS obligatoire** : sans lui, pas de service worker (donc pas d'installation ni de mode hors ligne).
  Seul `localhost` y échappe, pour les essais.
- Aucune réécriture d'URL : la navigation passe par `#/…`, toutes les pages sont `index.html`.
- Racine de domaine ou sous-dossier indifférents : les chemins sont relatifs (`base: './'`).
- Recommandé : `sw.js`, `index.html` et `manifest.webmanifest` servis sans cache longue durée
  (`Cache-Control: no-cache`), sinon les mises à jour arrivent en retard ; `assets/*` peut être mis en cache
  un an (noms avec empreinte). `public/_headers` le fait sur Netlify et Cloudflare Pages.

## Avant de publier
```
npm run release
```
Enchaîne types, lint, tests unitaires et de parité, build, parcours Playwright (téléphone et ordinateur, hors ligne
et mise à jour compris) et audit Lighthouse (échec sous 90 dans une catégorie). Rapports dans `reports/lighthouse/`.

## Hébergeurs
| Hébergeur | Mise en place |
|---|---|
| GitHub Pages | Pousser le dépôt sur GitHub, Réglages → Pages → Source : « GitHub Actions ». `.github/workflows/deploy.yml` vérifie, construit et publie à chaque envoi sur `main`. |
| Netlify | Commande de build `npm run build`, dossier `dist`. `_headers` est pris en compte. Ou glisser `dist/` sur app.netlify.com/drop. |
| Cloudflare Pages | Build `npm run build`, sortie `dist`. `_headers` est pris en compte. |
| Serveur web (nginx, Apache, OVH…) | Copier le contenu de `dist/` ; régler les en-têtes de cache ci-dessus. |

## Mises à jour
Chaque build produit un nouveau `sw.js`. Les utilisateurs ouverts reçoivent le message « Une nouvelle version est
disponible » (vérification à l'ouverture puis toutes les heures, ou depuis Réglages → Rechercher une mise à jour).
« Mettre à jour » enregistre le projet en cours puis recharge. Les données ne sont jamais touchées par une mise à jour ;
les changements de format passent par les migrations (`src/storage/migrations.ts`).

## Icônes
Source : `src/pwa/icon.ts`. Après modification : `npm run icons` (régénère `public/favicon.svg` et `public/icons/`).
