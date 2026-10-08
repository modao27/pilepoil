# Boîte à outils rénovation — PWA

Application web progressive (installable, hors ligne) qui regroupe des outils de rénovation autour d'un même
projet : un plan de pièces commun, des modules de calcul (carrelage, parquet, puis d'autres), une liste d'achat
consolidée. Utilisateur principal : un artisan / bricoleur averti, surtout sur téléphone, parfois sur ordinateur.

Nom de l'application : **Pilepoil** (identifiant technique `pilepoil`), mis en place en phase S3.
Jusque-là, l'appli publiée garde le nom « Calepinage ». Décisions prises : `docs/BOITE.md` §11.

## Documents
| Fichier | Contenu |
|---|---|
| `docs/BOITE.md` | Architecture de la boîte à outils : contrat de module, plan commun, modèle v2, achats, routes |
| `docs/PLAN.md` | Phases en cours (socle puis parquet), critères de fin |
| `docs/PROMPTS.md` | Consignes à coller par phase |
| `docs/UX.md` | Système de design et principes d'interface (communs à tous les modules) |
| `docs/MODEL.md` | Modèle persisté v1 et stockage (la v2 est décrite dans `docs/BOITE.md`) |
| `docs/carrelage/` | Module carrelage : règles métier (`DOMAIN.md`), historique des phases |
| `docs/parquet/SPEC.md` | Module parquet : spécification complète (cible V3) |
| `docs/DEPLOY.md` | Mise en ligne statique |
| `legacy/calepinage.html` | Ancienne version du carrelage, référence de parité |

## Pile
- Vite + TypeScript (strict) + Svelte 5 (runes)
- three.js pour la 3D, jsPDF pour les PDF
- idb (IndexedDB) pour le stockage, vite-plugin-pwa (Workbox) pour le hors ligne
- Vitest (unitaires, parité), Playwright (parcours complets, profil mobile 390 px + desktop)
- Pas de framework CSS : variables CSS et composants maison (`docs/UX.md`)
- Toute nouvelle dépendance doit être justifiée dans le message de commit (taille, maintenance, licence).

## Architecture cible
```
src/
  core/              partagé, logique pure : AUCUN import de DOM, Svelte, three.js ou stockage
    geometry/        polygones (existant) + booléens sur polygones quelconques avec trous
    plan/            modèle du plan commun : pièces polygonales, ouvertures, obstacles, passages
    cutting/         outils de découpe partagés : barres 1D, stock de chutes
    shopping/        lignes d'achat consolidées, conditionnements, prix
    hash, units…
  modules/
    registry.ts      liste des modules (ordre d'affichage)
    types.ts         contrat ToolModule
    carrelage/       core/ state/ ui/ render/ — code carrelage existant, déplacé
    parquet/         core/ state/ ui/ render/
  state/             store projet (immutable), historique, actions du plan, aiguillage vers les modules
  storage/           IndexedDB : projets, bibliothèques (carreaux, lames), photos, migrations, import legacy
  workers/           compute.worker.ts : aiguille chaque demande vers le moteur du module
  render/            rendus partagés : vue du plan, base de scène 3D, aides SVG/canvas
  ui/                coquille, écrans communs (accueil, projet, plan, achats, bibliothèques, réglages),
                     design system
  pwa/
tests/               unit/, parity/ (carrelage), browser/, e2e/
```

## Règles d'architecture
- `core` et `modules/*/core` sont déterministes et sérialisables (JSON simple) pour passer par le worker.
- Un module n'importe **jamais** un autre module. Ce qui sert à deux modules descend dans `src/core`,
  `src/render` ou `src/ui` (avec ses tests), et les tests de parité carrelage doivent rester verts.
- Un module expose deux points d'entrée, un par face du contrat de `docs/BOITE.md` : `modules/<id>/index.ts`
  (application, écrans chargés à la demande) et `modules/<id>/engine.ts` (moteur, importé seulement par
  `modules/engines.ts`, donc par le worker).
- L'UI ne calcule rien de métier : elle appelle le moteur via le worker et affiche.
- Les rendus ne modifient pas l'état ; les interactions passent par des actions du store.
- Les alertes du moteur sont des codes ; le texte est produit par l'interface (`ui/lib/messages.ts` ou celui
  du module).
- Ajouter un module ne modifie que : `modules/registry.ts`, le module lui-même, et si besoin une migration.
- La coquille (`core`, `state`, `storage`, `render`, `ui`, `workers`) ne voit les modules que par
  `modules/registry.ts`, `modules/types.ts` et `modules/engines.ts` (règle ESLint) ; les tests peuvent importer
  les internes d'un module.
- Code commun extrait au moment où un second module en a besoin, pas avant (`docs/BOITE.md` §10).

## Conventions
- **Unités internes : millimètres** partout dans `core`, `modules` et `state`. Conversion à l'affichage.
- Points en tuples `[x, y]`. Repère : origine en haut à gauche, x vers la droite, y vers le bas.
- Interface **en français**, phrases courtes, verbes d'action, pas de majuscules partout, pas de jargon.
- Nommage du code en anglais. Pas de `any`. Fonctions pures et petites dans les `core`.
- Accessibilité : cibles tactiles ≥ 44 px, focus visible, contraste AA, `prefers-reduced-motion`, mode sombre.

## Qualité
- Chaque module `core` a ses tests, y compris les invariants listés dans sa spécification.
- Carrelage : la parité avec `legacy/` reste à 100 % pendant toute la restructuration. Un test de parité
  rouge bloque la phase.
- Parquet : tests unitaires, tests de propriétés (`fast-check`) sur les invariants, cas de référence chiffrés.
- `npm run check` (types + lint + tests) doit passer avant chaque commit.
- Commits petits et décrits en français. Une phase = une branche, fusionnée quand ses critères sont remplis.
- Avant de coder une phase : montrer le plan (fichiers touchés, types, étapes), attendre la validation.
