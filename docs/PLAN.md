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
  `src/modules/carrelage` n'est importé que via son `index.ts` (et `engine.ts` par `engines.ts`), hors tests.

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
- Ajoutés à la demande (2026-10-09) : croquis coté des coupes en biais, seuil tracé à la main,
  optimisation sous 2 s pour 100 m² de motif, choix de l'outil à la création d'un projet.

## Carrelage bâti sur le plan commun

État : phases C1 à C4 terminées le 2026-10-09.

Décidé le 2026-10-09 : **le plan est la seule source de la géométrie**. Le carrelage ne décrit plus ses
propres surfaces ni sa pièce rectangulaire A–D : il carrèle des éléments du plan, le **sol d'une pièce**
(polygone, obstacles) ou **un mur** (longueur du mur × hauteur de la pièce, portes et fenêtres du plan). Il
garde ce qui lui est propre : carreaux, motif, zones, joint, hauteur carrelée, réservations (prises,
baignoire, trappe), tableaux de fenêtre, plinthe, finitions. Carrelage et parquet partagent le même plan.

Choix retenus :
- un mur du plan = une surface de carrelage (plus de surface dépliée sur plusieurs murs) ;
- l'application n'a pas encore d'utilisateurs : aucun ancien projet n'est converti, on repart d'une base
  vide (nouvelle version de la base) ;
- la parité avec `legacy/` porte sur le moteur, pour les surfaces rectangulaires (contour vide) ; les
  nouvelles formes sont couvertes par des invariants et des cas chiffrés.

### C1 — Moteur : surfaces de forme quelconque
- `SurfaceSpec` reçoit un contour facultatif. Vide : calcul inchangé. Donné (sol en L, en U, mur en
  biais) : chaque carreau est découpé par le contour avec `core/geometry/boolean` ; classement entier /
  coupé / coupe fine, réemploi des chutes et coupes apparentes suivent.
- Tests : sol en L avec poteau, mur en biais, invariants d'aire, propriétés (`fast-check`).
- Fini quand : parité verte à 100 %, invariants verts sur des contours quelconques, aucun changement pour
  une surface sans contour.

### C2 — Modèle et état du carrelage sur le plan
- Données du carrelage rangées par élément du plan : `rooms[roomId].floor`, `rooms[roomId].walls[wallId]`
  (réglages propres au carrelage seulement). `toSpec` construit chaque surface depuis le plan (contour,
  ouvertures, obstacles, hauteur). Avertissements du plan (pièce ou mur supprimé).
- Achats, scénarios (« Comparer ») et résumé adaptés. Nouvelle version de la base, sans conversion.
- Fini quand : un mur et un sol du plan se calculent sans ressaisie de cotes ; modifier le plan met le
  carrelage à jour ; tests du modèle et de `toSpec` verts.

### C3 — Interface du carrelage sur le plan
- Écran Carrelage : pièces du plan, sol et murs à cocher pour les carreler. Éditeur d'une surface (mêmes
  onglets qu'aujourd'hui), cotes en lecture seule avec lien vers le plan.
- Assistant de démarrage rapide : dessine la pièce dans le plan puis ouvre le carrelage.
- Vue de la pièce (plan 2D et 3D) depuis le polygone du plan ; Résultats et PDF adaptés.
- Fini quand : parcours e2e « dessiner une pièce en L → carreler le sol et deux murs → acheter » sur
  téléphone et ordinateur ; carrelage et parquet dans le même projet.

### C4 — Nettoyage
- Retirer l'import des données de l'ancienne appli, la copie de l'ancienne base `calepinage`, la
  migration des projets v1 → v2 et les redirections des anciennes adresses. `legacy/calepinage.html` reste,
  seulement comme référence de parité du moteur.
- Docs : `BOITE.md`, `MODEL.md`, `carrelage/DOMAIN.md`, règle de parité reformulée dans `CLAUDE.md`.
- Fini quand : `npm run release` vert, plus de code mort lié aux anciens formats.

## Parcours centré sur le projet (N0 à N5)

Décidé le 2026-10-09 : cible et vocabulaire dans `docs/NAVIGATION.md` (projet → pièce → surface → zone → pose,
carrelage et parquet de la même manière, vue globale au centre, sélection sur le dessin). Pas de conversion des
projets existants : nouvelle version de la base, projets précédents retirés.

### N0 — Sécurité des données
- Annulation d'une suppression qui survit à la navigation : elle ne réécrit jamais un état plus ancien que
  le projet actuel (plan, Achats).
- Suppression d'une pièce revêtue : confirmation qui détaille ce qui sera perdu.
- Tous les enregistrements hors éditeurs : erreur affichée, action réessayable, bouton rendu.
- Fini quand : tests unitaires et e2e de ces trois cas sur téléphone et ordinateur.

### N1 — Zones et poses dans le projet
- `project.zones` et `project.poses` (`NAVIGATION.md` §4), règles de recouvrement et de continuité dans
  `core`, réducteur `zone/*` et `pose/*`, contrat de module élargi ; réglages des modules rangés par pose.
- Carrelage et parquet branchés sur ce modèle (le parquet perd ses listes de pièces et limites de zone
  propres) ; « zone » du carrelage renommée « bande ». Assistant carrelage retiré.
- Nouvelle version de la base, sans conversion.
- Fini quand : tests du modèle et des règles verts ; les deux moteurs calculent une pose depuis ses zones ;
  parité legacy du moteur carrelage à 100 %.

### N2 — Moteur carrelage : poses continues
- Pose sur plusieurs sols reliés par un passage (union des zones, même alignement, même plan de découpe).
- Pose sur des murs qui se suivent (angles du moteur rebranchés depuis le plan).
- Fini quand : cas chiffrés et invariants verts, parité à 100 %.

### N3 — Vue globale et écran Pièce
- Vue globale : plan cliquable, pièces, poses et états. Écran Pièce : sélection du sol et des murs sur le
  dessin, découpe en zones (ligne, contour, crédence), poses (nouvelle, continuer, retirer). Fil de navigation.
- Fini quand : parcours e2e « pièce → zones → poses carrelage et parquet » sur téléphone et ordinateur.

### N4 — Coquille commune du calepinage
- Même écran et mêmes étapes (Produit, Pose, Découpage, Finitions, Avancé) pour le carrelage et le parquet,
  sans retirer de réglage.
- Fini quand : les deux revêtements se règlent de la même façon, e2e verts.

### N5 — Résultats, export et 3D
- Résultats et PDF par surface, pièce et projet ; 3D de la pièce et du projet (revêtements ensemble).
- Fini quand : parcours complet « nouveau projet → pièce → zones → poses → résultats → PDF → vue globale »
  sur téléphone et ordinateur, budgets 3D tenus, `npm run release` vert.

## Décisions en attente
- Synchronisation entre appareils : hors périmètre pour l'instant, tout reste sur l'appareil.

Décisions prises : voir le journal de `docs/BOITE.md` §11.
