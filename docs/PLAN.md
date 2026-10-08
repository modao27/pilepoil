# Phases — boîte à outils et module parquet

État de départ : application carrelage terminée (phases 1 à 7, voir `docs/carrelage/PLAN.md`).
Objectif : socle commun, puis module parquet complet (cible V3, `docs/parquet/SPEC.md`).

Règles pour toutes les phases :
- une branche par phase, fusionnée sur `main` quand les critères sont remplis ;
- `npm run check` vert à chaque commit, parité carrelage à 100 % du début à la fin ;
- `npm run test:e2e` vert en fin de phase (téléphone 390 px et ordinateur) ;
- l'application publiée reste utilisable après chaque fusion.

## Socle

### S1 — Restructuration en modules (aucun changement visible)
- Garde-fous d'abord : règles ESLint de frontière (`modules/*/core` pur, aucun import entre modules,
  `core` n'importe pas `modules`, pas d'import interne d'un module hors de ses tests) et
  `tsconfig.core.json` étendu à `src/modules/*/core`.
- Créer `src/modules/types.ts` (contrat complet, `docs/BOITE.md` §2), `registry.ts`, `engines.ts`.
  Le carrelage n'implémente en S1 que la face moteur et `id`, `label`, `icon`, `screens`.
- Déplacer le code propre au carrelage dans `src/modules/carrelage/` (`git mv`, imports mis à jour).
  Restent partagés : types et fonctions de géométrie de base, `constants`, `hash`, historique, store
  (réducteur passé en paramètre), stockage, `render/view.ts`, design system, composants génériques,
  coquille. Le PDF, la scène 3D et les motifs partent avec le carrelage (extraits plus tard,
  `docs/BOITE.md` §10).
- Scinder l'état global (`ui/lib/app.svelte.ts`) : coquille (base, projets, préférences, photos) et
  carrelage (bibliothèque de carreaux, calculs, scénarios).
- Worker : aiguillage par module (`docs/BOITE.md` §6), carrelage branché dessus.
- Routes préfixées `#/p/:id/m/carrelage/…`, redirections depuis les anciennes.
- Fini quand : aucun changement visible pour l'utilisateur, parité 100 %, tous les tests verts,
  `src/modules/carrelage` n'est importé que via son `index.ts` (hors tests).

### S2 — Modèle v2 et plan commun
- Types du plan (`core/plan`), validation, réducteur, tests. Murs à identifiant stable et épaisseur
  propre, découpage et fusion des murs quand on ajoute ou retire un point (`docs/BOITE.md` §3).
- `core/hash` : générateur pseudo-aléatoire à graine et empreinte stable d'un objet JSON.
- `core/geometry/boolean.ts` : union, différence, intersection, offset sur polygones non convexes avec
  trous, derrière nos propres fonctions ; tests de propriétés.
- Modèle v2, migration `v1 → v2` et nouvelle version IndexedDB (magasin `boards`), tests sur documents figés.
  Import legacy → projet v2.
- Écran Projet (cartes des modules, « Ajouter un outil ») et éditeur de plan (`docs/BOITE.md` §9).
- Fini quand : un projet existant s'ouvre comme avant après migration ; on dessine une pièce en L avec un
  poteau, une porte, et une seconde pièce reliée par un passage, sur téléphone ; tout est annulable.

### S3 — Achats consolidés et bibliothèques
- `ShoppingLine`, adaptateur carrelage, écran Achats du projet (regroupement, totaux, PDF, CSV).
- Bibliothèques séparées : carreaux (existante) et lames (formulaire + modèles types, voir
  `docs/parquet/SPEC.md` §2), routes `#/library/…`.
- Nom de l'application : **Pilepoil**. Renommage complet :
  - titre, manifeste (nom, `id`, `start_url`, `scope`), icônes ;
  - base IndexedDB `pilepoil`, copie unique depuis `calepinage` au premier lancement, avec un test ;
    l'ancienne base est gardée intacte comme filet de sécurité ;
  - dépôt GitHub renommé `pilepoil` ; à l'ancienne adresse Pages, une page qui redirige vers la nouvelle
    (GitHub ne redirige pas les sites Pages) ;
  - message dans l'appli pour proposer de supprimer l'ancienne appli installée.
- Fini quand : la liste d'achat du projet reprend à l'identique celle du carrelage, une lame se crée et
  s'enregistre dans la bibliothèque, et un projet créé sous l'ancien nom se retrouve après mise à jour.

## Module parquet

### P1 — Données et pose droite
- `ParquetData`, `Board`, valeurs par défaut, migrations, actions, `toSpec`.
- Moteur pose droite (`SPEC.md` §4.1, §4.2 sans l'optimisation) : surface posable, rangs, équilibrage,
  remplissage 1D, chutes, décalage régulier, diagonale, longueurs mixtes.
- Éditeur minimal : choix des pièces, de la lame, du motif droit, de l'angle ; plan 2D des lames ; résumé.
- Fini quand : cas R1, R2, R3, R4, R6, R9 verts ; invariants verts en tests de propriétés ;
  30 m² calculés en moins de 300 ms.

### P2 — Bâton rompu et point de Hongrie
- Déplacer `herring` et `chevron` de `modules/carrelage` dans `src/core/patterns/` (partagé), parité
  carrelage verte. Vérifier d'abord que la parité de cellule correspond bien aux lames gauche / droite.
- Hongrie à 60°, variantes A/B, placement de l'axe (3 propositions), découpage par booléens,
  réemploi des chutes en 2D sans rotation.
- Fini quand : cas R5 vert, invariants verts pour les deux motifs à 0°, 45° et 90°.

### P3 — Plusieurs pièces et fractionnement
- Poses sur plusieurs pièces reliées, repère de motif commun, seuils proposés et acceptés, `breaks`.
- Fini quand : cas R7 et R8 verts ; rangs visuellement continus d'une pièce à l'autre.

### P4 — Optimisation, plinthes, résultats
- Optimisation du départ en tranches annulables avec progression.
- `core/cutting/bars.ts` (partagé) et plinthes.
- Lignes d'achat du parquet dans la liste consolidée ; écran Résultats (Plan, Coupes, Achats) ;
  fiche de coupe dans l'ordre de pose ; export PDF A4 (extraire d'abord la base PDF du carrelage
  dans `ui/lib`, sans changer le PDF du carrelage).
- Fini quand : R1 ≤ 52 lames après optimisation ; PDF lisible imprimé ; liste d'achat juste sur R1 et R7.

### P5 — 3D, chantier, finitions
- Vue 3D (texture orientée par pièce, plinthes), en extrayant d'abord la base de scène du carrelage dans
  `render/scene3d` ; mode chantier avec suivi hors ligne.
- Tests e2e du parcours complet parquet, audit Lighthouse ≥ 90, mise en ligne.
- Fini quand : parcours « dessiner deux pièces → poser un point de Hongrie → acheter → suivre la pose »
  réalisable sur téléphone sans aide ; 60 i/s en 3D pour 30 m².

## Décisions en attente
- Réglages par défaut du parquet (avant P1) : selon le type de lame, le mode de pose, ou les deux.
  Proposition : le type de lame donne les valeurs, et une pose collée ou clouée désactive les alertes de
  fractionnement et de passage (`docs/parquet/SPEC.md` §2).
- Liaison plan ↔ surfaces carrelage (après P5).
- Synchronisation entre appareils : hors périmètre pour l'instant, tout reste sur l'appareil.

Décisions prises : voir le journal de `docs/BOITE.md` §11.
