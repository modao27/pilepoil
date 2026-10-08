# Prompts à coller dans Claude Code

Lancer Claude Code à la racine du dépôt (qui contient `CLAUDE.md`, `docs/` et `legacy/`).

## Phase 1
Lis CLAUDE.md et les fichiers de docs/. Réalise la phase 1 de docs/PLAN.md.
Commence par initialiser le projet (Vite, Svelte 5, TypeScript strict, ESLint, Prettier, Vitest, Playwright).
Ensuite porte le moteur de legacy/calepinage.html dans src/core/ module par module, avec tests.
Écris un script qui extrait les résultats de legacy sur un jeu de configurations de référence et des tests de parité.
Montre-moi le plan des modules avant d'écrire le code, puis avance module par module en lançant les tests.

## Phase 2
Réalise la phase 2 de docs/PLAN.md. Propose d'abord les types du modèle et le schéma IndexedDB,
puis implémente store, historique, stockage, migrations, import legacy et worker de calcul, avec tests.

## Phase 3
Réalise la phase 3. Commence par le design system de docs/UX.md (tokens + composants) avec une page
de démonstration, puis la navigation, l'accueil, la bibliothèque de carreaux et l'assistant.
Vérifie chaque écran en profil mobile (390 px) et desktop avec Playwright et des captures.

## Phase 4
Réalise la phase 4 : éditeur de surface complet. Reprends toutes les fonctions de legacy (zones, motifs,
ouvertures, angles, plinthes, optimisation, coupes, chutes). Captures mobile et desktop à chaque étape.

## Phase 5
Réalise la phase 5 : vue pièce et scène three.js.

## Phase 6
Réalise la phase 6 : résultats, comparaison et export PDF.

## Phase 7
Réalise la phase 7 : PWA, hors ligne, audit Lighthouse, tests e2e complets. Prépare la mise en ligne statique.
