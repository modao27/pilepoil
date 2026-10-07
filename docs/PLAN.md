# Phases

Chaque phase se termine par une version utilisable, des tests verts et un commit. Ne pas commencer une phase
avant que la précédente soit validée.

## Phase 1 — Fondations et moteur
- Projet Vite + Svelte 5 + TypeScript strict, ESLint, Prettier, Vitest, Playwright, script `npm run check`.
- Porter le moteur de `legacy/calepinage.html` dans `src/core/` (geometry, patterns, layout, cutting, optimizer, rules, shopping).
- Tests unitaires + tests de parité : un script extrait les résultats de legacy (via Playwright sur le fichier legacy)
  pour ~50 configurations de référence et les compare au nouveau moteur (quantités, coupes, réemploi).
- Critère : parité 100 %, invariants de `DOMAIN.md` verts. Aucune interface encore.

## Phase 2 — Données et stockage
- Types du modèle (`DOMAIN.md`), bibliothèque de carreaux, store immutable, historique annuler/rétablir.
- IndexedDB (projets, carreaux, photos en Blob), migrations versionnées.
- Import automatique des données legacy (`localStorage` : `calepinage-v3`, `calepinage-v2`, `calepinage-scenarios`, `calepinage-nuancier`).
- Worker de calcul (`compute.worker.ts`) avec annulation des calculs obsolètes.
- Critère : un projet legacy importé redonne les mêmes résultats.

## Phase 3 — Interface de base
- Design system (tokens, composants de `UX.md`), thème clair/sombre.
- Routage, Accueil, Bibliothèque de carreaux, Réglages, assistant de création.
- Critère : créer un projet de bout en bout sur téléphone, sans éditeur détaillé.

## Phase 4 — Éditeur de surface
- Plan 2D interactif (zoom, déplacement du motif, sélection, aimantation), rendu 2D avec photos.
- Panneau tiré (mobile) / inspecteur (desktop), onglets, résumé permanent, alertes actionnables.
- Optimisation dans le worker avec progression et annulation.
- Critère : toutes les fonctions de legacy accessibles, tests e2e mobile.

## Phase 5 — Pièce et 3D
- Vue de dessus de la pièce, navigation entre surfaces.
- Scène three.js : murs pliés, sol, ouvertures avec embrasures, baignoire, textures photo, ombres réelles.
- Critère : 60 i/s sur un téléphone récent pour une pièce de 15 m².

## Phase 6 — Résultats et export
- Écran Résultats (commande, découpe, achats, encollage), comparaison A/B.
- Export PDF (plan coté, plan de découpe, liste d'achat), partage.
- Critère : PDF lisible imprimé en A4.

## Phase 7 — PWA et finitions
- Manifeste, icônes, service worker (précache + mise à jour avec message), fonctionnement hors ligne.
- Audit Lighthouse (PWA, accessibilité, performances ≥ 90), tests e2e complets, hébergement HTTPS.
