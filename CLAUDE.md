# Calepinage — PWA de calepinage carrelage

Application web progressive (installable, hors ligne) pour préparer une pose de carrelage :
calepinage par zones et motifs, coupes, réemploi des chutes, quantités, liste d'achat, rendu 2D/3D.
Utilisateur principal : un artisan / bricoleur averti, surtout sur téléphone, parfois sur ordinateur.

## Référence fonctionnelle
`legacy/calepinage.html` est la version actuelle (fichier unique, testée). C'est la **source de vérité**
pour les règles métier et les résultats chiffrés. Toute fonction portée doit donner les mêmes résultats
(mêmes quantités, mêmes coupes) tant qu'une évolution n'est pas décidée explicitement.
Règles métier détaillées : `docs/DOMAIN.md`. Écrans et interactions : `docs/UX.md`. Phases : `docs/PLAN.md`.

## Pile
- Vite + TypeScript (strict) + Svelte 5 (runes)
- three.js pour la vue 3D
- idb (IndexedDB) pour le stockage, vite-plugin-pwa (Workbox) pour le hors ligne
- Vitest (unitaires), Playwright (parcours complets, profil mobile + desktop)
- Pas de framework CSS : variables CSS et composants maison (voir `docs/UX.md`)

## Architecture
```
src/
  core/        logique pure : AUCUN import de DOM, Svelte, three.js ou stockage
    geometry/  polygones, clip, inset, aires, tests point-dans-polygone
    patterns/  un module par motif : { id, label, geo(), generate(), icon }
    layout/    zones, angles de mur, ouvertures/réservations, tableaux, plinthes
    cutting/   construction des pièces, bords d'usine, coupes apparentes, réemploi des chutes
    optimizer/ recherche du meilleur départ (exécutée dans un worker)
    rules/     encollage, joint, consommables : tables de données + fonctions
    shopping/  commande par produit, liste d'achat, coûts
  state/       store projet (immutable), historique annuler/rétablir, sélecteurs, migrations
  storage/     IndexedDB : projets, bibliothèque de carreaux, photos (Blob), import de l'ancienne version
  workers/     compute.worker.ts : calcul d'une surface / d'un projet, optimisation
  render/      plan2d, render2d (canvas), scene3d (three.js) — lisent l'état, n'écrivent jamais
  ui/          écrans, composants, design system
  pwa/         manifeste, icônes
tests/         unit/ (core), e2e/
```
Règles :
- `core` est déterministe et sérialisable (entrées/sorties en JSON simple) pour passer par le worker.
- L'UI ne calcule rien de métier : elle appelle `core` via le worker et affiche.
- Les rendus ne modifient pas l'état ; les interactions passent par des actions du store.
- Un motif = un fichier dans `core/patterns/`, enregistré dans un registre. Ajouter un motif ne touche rien d'autre.

## Conventions
- **Unités internes : millimètres** partout dans `core` et `state`. Conversion uniquement à l'affichage.
  Affichage : carreaux et coupes en mm ; surfaces, ouvertures, zones, plinthes en cm ; m² pour les quantités.
- Repère d'une surface : origine en haut à gauche, x vers la droite, y vers le bas.
- Interface **en français**, phrases courtes, verbes d'action, pas de majuscules partout, pas de jargon technique.
- Nommage du code en anglais. Pas de `any`. Fonctions pures et petites dans `core`.
- Accessibilité : cibles tactiles ≥ 44 px, focus visible, contraste AA, `prefers-reduced-motion`, mode sombre.

## Qualité
- Chaque module `core` a ses tests. Reprendre les invariants de `docs/DOMAIN.md` §Invariants
  (couverture exacte à joint 0, pas de chevauchement, pièces ≤ carreau, chutes ≤ carreau…).
- Tests de parité avec `legacy/` sur un jeu de configurations de référence (motifs × angles × départs × options).
- `npm run check` (types + lint + tests) doit passer avant chaque commit.
- Commits petits et décrits en français.
