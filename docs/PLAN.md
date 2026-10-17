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
  `render/scene3d` ; mode chantier avec suivi hors ligne (retiré le 2026-10-15).
- Tests e2e du parcours complet parquet, audit Lighthouse ≥ 90, mise en ligne.
- Fini quand : parcours « dessiner deux pièces → poser un point de Hongrie → acheter »
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
- Nouveau projet : le plan d'abord (nom du projet et première pièce, pièce dessinée nommée à la fermeture),
  pas de projet vide, revêtements choisis après le plan.
- Pose sur plusieurs sols reliés par un passage (union des zones, même alignement, même plan de découpe).
- Pose sur des murs qui se suivent (angles du moteur rebranchés depuis le plan), hauteur carrelée par mur.
- Écran Carrelage : « Continuer la pose voisine / Nouvelle pose » ; retirer une surface sépare la pose.
- Fini quand : cas chiffrés et invariants verts, parité à 100 %.

### N3 — Vue globale et écran Pièce
- Vue globale : plan cliquable, pièces, poses et états. Écran Pièce : sélection du sol et des murs sur le
  dessin, découpe en zones (ligne, contour, crédence), poses (nouvelle, continuer, retirer). Fil de navigation.
- Ajouté (2026-10-09) : épaisseur des murs (réglage par défaut 72 mm, par pièce, tableaux, 3D) ; pièce posée
  contre une autre et porte vers la voisine ; écran Carrelage remplacé par l'écran Pièce.
- Reporté en N4 : découpe d'un sol par un contour (seule la ligne existe).
- Fini quand : parcours e2e « pièce → zones → poses carrelage et parquet » sur téléphone et ordinateur.

### N4 — Coquille commune du calepinage
- Même écran et mêmes étapes (Produit, Pose, Découpage, Finitions, Avancé) pour le carrelage et le parquet,
  sans retirer de réglage.
- Fini quand : les deux revêtements se règlent de la même façon, e2e verts.
- Ajouté : découpe d'un sol par un contour (reportée de N3) ; création et suppression des poses du parquet sur
  l'écran Pièce seulement ; mesures de durée lancées seules (tests/perf).

### N5 — Résultats, export et 3D
- Résultats et PDF par surface, pièce et projet ; 3D de la pièce et du projet (revêtements ensemble).
- Fini quand : parcours complet « nouveau projet → pièce → zones → poses → résultats → PDF → vue globale »
  sur téléphone et ordinateur, budgets 3D tenus, `npm run release` vert.
- Décidé (2026-10-12) : premier niveau = la pose (pas la surface) ; prix sur l'écran Achats seulement ; enveloppe 3D
  commune ; dossier du projet complet. Parcours e2e : `tests/e2e/journey-results.spec.ts`.
- Ajouté : premier chargement allégé (Lighthouse ≥ 90 sur téléphone, premier passage) ; 3D : mur revêtu en partie
  complété par l'enveloppe, sol continu rogné à la pièce dans ses résultats.

## Module peinture (PE0 à PE5)

Spécification : `docs/peinture/SPEC.md`. Une branche par phase, `npm run check` vert, parité carrelage à 100 %.

### PE0 — Spécification
- `docs/peinture/SPEC.md`, entrées dans `docs/BOITE.md` §11 et `CLAUDE.md`. Aucun code.
- Fini quand : le périmètre, les coefficients et les cas chiffrés sont validés.

### PE1 — Moteur
- `modules/peinture/core` : surface nette (ouvertures à seuil), couches, litres, enduit, boiseries, consommables,
  combinaison de pots ; tests de propriétés et cas de référence de la spec §7.
- Fini quand : les invariants §6 et les cas chiffrés passent.
- Fait : `modules/peinture/core` (types, defaults, surface, packs, compute), `tests/unit/peinture.test.ts`.

### PE2 — Module, données, bibliothèque
- Modules `index.ts` / `engine.ts`, données par pose, actions, règle « murs seulement », bibliothèque `paints`
  (nouvelle version de base, migration testée), modèles types, `'pot'` dans `ShoppingUnit`, `shopping()`.
- Fini quand : une peinture se crée en bibliothèque et une pose se calcule par le worker.
- Décidé (2026-10-13) : module caché des menus (`ModuleManifest.hidden`) jusqu'à PE3 ; prix au niveau du module.
- Fait : base v5, `modules/peinture` complet côté données, achats et bibliothèque ; écran de pose provisoire.
  Reste pour PE3 : retirer `hidden`, écran de pose, suppression d'un produit utilisé par un projet.

### PE3 — Interface
- Action « Peindre » sur l'écran Pièce, écran de pose (murs, produit, couches, support, boiseries, résultat en
  direct), section Résultats, tests e2e (390 px et bureau).
- Fini quand : on peint un mur entier et une zone de mur sur téléphone, avec le coût.
- Fait : éditeur dans la coquille commune (murs à plat, étapes Produit / Pose / Découpage / Finitions / Avancé),
  rapport par pose et par pièce, section Résultats par mur, bouton « Réglages » de l'écran Pièce
  (`ModuleManifest.poseLabel`), module visible (le drapeau `hidden` de PE2 est retiré, plus utilisé).
  Test e2e : `tests/e2e/peinture.spec.ts`. Le détail par zone passe par `PaintResult.zones`.

### PE4 — Achats, PDF, 3D
- Lignes dans l'écran Achats et son PDF, PDF de la pose, couleur du produit sur les murs de la vue 3D.
- Fini quand : la liste d'achat consolidée contient la peinture avec ses pots.
- Fait : PDF de la pose, de la pièce et du projet (`modules/peinture/ui/lib/pdf.ts`), murs peints en 3D
  (`render/scene3d/paint.ts`, posés à 2 mm devant le plâtre : `ResultExports.overlay` laisse l'enveloppe entière),
  lignes d'achat et unité `pot` déjà en PE2. Parcours e2e complété (3D, PDF).

### PE5 — Plafonds (plus tard)
- Surface « plafond » dans `core/coverage` (`SurfaceRef`), affichage, 3D, règles ; peinture du plafond.

## Module cloisons (T0, CL1 à CL3)

Spécification : `docs/cloisons/SPEC.md` ; plan v3 : `docs/BOITE.md` §3 bis. Décidé le 2026-10-13. Une branche par
phase, `npm run check` vert, parité carrelage à 100 %. Préfixe `CL` (C1 à C4 sont les phases du carrelage) ; `T0` est la
phase du plan avec travaux, sans module nouveau. `core/cutting/bars.ts` existe déjà (P4) : il est réutilisé tel quel.

### T0 — Plan v3 : état existant et travaux
- Types `Site`, `Partition`, `Demolition`, `Wall.locked` et `Wall.of` ; `core/plan/derive.ts` (`planAfter`, identité des
  pièces par ancre, provenance des arêtes), `core/plan/works.ts` (réducteur `plan/partition/*`, `plan/demolition/*`,
  validation en codes).
- Projet v4 : `site` enregistré, `plan` calculé (réducteur, chargement), `projectFrom(plan)` pour les tests ;
  migration 3 → 4 sur document figé, base v6 (magasin `systems`), étape de purge v4 figée à 3, scénarios A/B migrés.
- Contrat : `coverage`, `poseHref`, `createPose` facultatifs ; `'structure'` dans `ShoppingGroup`.
- Éditeur de plan : bascule Existant | Travaux, verrou des murs et « Verrouiller les murs extérieurs », outils Cloison,
  Démolir, Porte / baie, aimantation aux faces et parallèles, confirmation de la surface revêtue perdue.
- Fini quand : les invariants de `docs/BOITE.md` §3 bis sont verts (tests de propriétés compris) ; un projet sans
  travaux est inchangé (même référence de plan, carrelage, parquet et peinture identiques, parité 100 %) ; parcours e2e
  « relever un L, verrouiller les murs extérieurs, tracer une cloison avec une porte, démolir une cloison, carreler la
  face d'une cloison neuve, annuler » sur téléphone et ordinateur ; la 3D montre les cloisons ; dérivation < 10 ms.
- Fait (2026-10-13) : jalon 1 (modèle, dérivation, projet v4, migration, contrat) et jalon 2 (éditeur : calques, verrou,
  outils Cloison, Démolir et porte, aimantation, confirmation de la surface revêtue perdue). Parcours e2e :
  `tests/e2e/works.spec.ts` ; tests : `derive`, `deriveCases`, `site`, `worksEditor`. Écarts : dérivation à froid
  < 30 ms et < 10 ms au glissement d'une cloison (SPEC §9) ; la démolition se règle par deux champs de cote, sans
  poignées.

### CL1 — Moteur
- `modules/cloisons/core` : rails, montants (doublages, baies, liaisons), plaques (décalages, chutes), isolant,
  consommables, alertes, hauteurs maximales ; usage de `core/cutting/bars.ts` pour rails et montants.
- Fini quand : les invariants du §6 et les cas R1 à R6 du §7 de la spécification passent ; 20 cloisons < 100 ms.
- Fait (2026-10-13) : `modules/cloisons/core` (types, defaults, studs, plates, compute) et `engine.ts`, pas encore
  branché dans `engines.ts` (CL2) ; tests `cloisons`, `cloisonsProperties`, `tests/perf/cloisonsPerf`. Décidé : joint de
  plaque près d'une baie corrigé (SPEC §4.3), chutes de plaques communes à tout le projet par type et épaisseur.

### CL2 — Module, données, bibliothèque, achats
- `index.ts` / `engine.ts`, `CloisonsData`, `toSpec` (longueur du corps, appuis, liaisons, faces carrelées), réducteur,
  bibliothèque `systems` avec modèles types, table des hauteurs et réglages, `shopping()` (groupe `structure`).
- Fini quand : une cloison dessinée dans le plan se calcule par le worker et ses lignes apparaissent dans les Achats.
- Fait (2026-10-13) : `modules/cloisons` complet côté données (`state/` : modèle, actions, `toSpec` avec longueur du
  corps, appuis, liaisons et faces carrelées ; achats, résumé), bibliothèque `systems` (modèles types 72/48, 98/48, 100/70,
  écrans liste et fiche), module enregistré (registre, worker), activé par la première cloison tracée, écran provisoire
  des cloisons (système, hauteur, entraxe, plaques, isolant, renforts, alertes, réglages communs et table des hauteurs).
  Tests : `cloisonsModule`, e2e `cloisons.spec.ts`. Reste pour CL3 : élévation, section Résultats, PDF.

### CL3 — Interface, résultats, PDF
- Écran du module, inspecteur d'une cloison, élévation (ossature et calepinage des plaques), section Résultats, PDF,
  cloisons en 3D (murs), test e2e.
- Fini quand : on passe du relevé à la liste d'achat des cloisons sur téléphone, sans aide.
- Fait (2026-10-13) : élévation des deux faces côte à côte (l'une sous l'autre sur téléphone), plaques numérotées d'une
  couche au choix, chutes en couleur de réemploi, fiche de coupe, ossature (`ui/lib/elevation.ts` partagé par l'écran et le
  PDF) ; section et rapport par cloison dans l'écran Résultats commun (niveaux projet et pièce, pas d'une pose : `PoseReport`
  gagne `title`, `where`, `href` pour un module sans pose) ; pages des cloisons dans le dossier du projet et PDF des seules
  cloisons depuis leur écran ; 3D : les cloisons sont déjà des murs du plan après travaux. Tests : `cloisonsResults`, e2e
  `cloisons.spec.ts`.

## Fiabilité et cohérence entre outils (F1)

Décidé le 2026-10-15, après une revue des quatre outils. Branche `phase/f1-fiabilite`.

- Un produit de bibliothèque utilisé par un projet ne se supprime pas (`LibraryDefinition.usedIn`, dialogue commun) ;
  un produit choisi absent est signalé par le moteur (peinture `product-missing`, cloisons `system-missing`).
- Un calcul qui échoue garde le résultat d'avant et le dit (`ComputeFailed`, Réessayer) ; l'écran Résultats dit la
  raison (`ModuleResults.errorText`) ; filet `unhandledrejection`.
- Les outils se lisent par la coquille : `wallBases` rassemblé par `projectContext` et passé à `toSpec`. La peinture
  retire la bande des plinthes et ne peint que les plinthes peignables (réglage manuel si le sol n'est pas revêtu) ;
  le parquet ne pose pas de plinthe le long d'un mur carrelé depuis le sol.
- Nettoyage : marges en fraction (parquet schéma 5, migration), clés d'achat du carrelage préfixées, carreaux types,
  `SYSTEM_SCHEMA`. Marge d'achat et hauteur de plinthe réglables dans l'éditeur du parquet.
- Écran Pièce : « Revêtir » la partie libre d'un mur (peinture au-dessus d'une crédence), qui n'était pas possible.
- Fini quand : tests unitaires et e2e verts sur téléphone et ordinateur, dont `tests/e2e/mixed.spec.ts` (les quatre
  outils dans un projet, achats et dossier PDF) et la peinture au-dessus d'une crédence (`peinture.spec.ts`).
- Fait (2026-10-15).

## Bibliothèques pré-remplies et import de fiches (B1)

Décidé le 2026-10-16. Branche `b1-bibliotheques`.

- Modèles types posés un par un, par identifiant (`state/seeding.ts`, préférence `templatesSeeded`) : un modèle
  ajouté par une mise à jour apparaît, un modèle supprimé ne revient pas.
- Catalogues : 24 carreaux et 26 lames relevés sur leroymerlin.fr le 2026-10-16 (caractéristiques techniques, ni
  photo ni prix ; lames par paquet déduites de la surface quand la fiche ne les donne pas), 4 peintures Leroy Merlin
  et 20 génériques. Bâtons rompus et points de Hongrie : nombre de lames de la fiche compté par paquet, à vérifier
  (on ne sait pas si un paquet mélange les lames A et B).
- Lecture d'une fiche collée (`src/core/sheet`, `fromSheet.ts` par module) ; « Coller une fiche produit » dans les
  formulaires ; `#/import` et favori « Envoyer à PilePoil » (Réglages).
- Fini quand : tests unitaires (catalogues, amorçage, lecture, correspondances, routes, favori) et e2e
  (`import.spec.ts`, bibliothèques) verts sur téléphone et ordinateur.

## Teintes de peinture dans la pose (B2)

Décidé le 2026-10-16. Branche `b2-teintes`.

- Palette de teintes nommées sans marque (`peinture/core/colors.ts`), teinte claire/moyenne/foncée déduite de la
  luminance (`tintOf`).
- Schéma peinture 2 : `color` des murs et `woodwork.color` dans chaque pose (null : teinte du produit), migration.
- Moteur et achats : alerte de teinte foncée selon la teinte de la pose ; besoins additionnés par produit et par
  teinte, une ligne d'achat par teinte (clé d'origine sans teinte).
- Éditeur : sélecteur de teinte (murs, boiseries) ; élévation, 3D, PDF et résultats à la teinte de la pose.
- Fini quand : tests unitaires (`peintureTints`) et e2e (même peinture, deux teintes, deux lignes de pots) verts.

## Lot A — Projets fiables (audit UI/UX)

Branche `lot-a-projets`. Corrige PRJ-01, PRJ-02, PRJ-03, UX-04, NOU-01 (`docs/audit/PROPOSITIONS.md`).

- Carte de projet commune (`ui/components/ProjectCard.svelte`) : plan, résumé par outil, coût, menu pour tous ; le
  contrat de module n'a plus `screens.card`.
- Suppression écrite tout de suite, « Annuler » réenregistre le projet.
- Accueil vide sans lien vers un import disparu ; « Annuler » d'un projet neuf ramène à l'accueil.
- Fini quand : `npm run check` et e2e verts sur téléphone et ordinateur (`tests/e2e/projects.spec.ts`), parité intacte.
- Fait (2026-10-17).

## Lot C — Liste d'achat juste (audit UI/UX)

Branche `lot-c-achats`. Corrige ACH-01, CAR-01, PAR-01, ACH-02, ROB-03 (`docs/audit/PROPOSITIONS.md`).

- Quantité et unité d'achat devant chaque ligne (écran, PDF) ; rails et montants avec leur longueur à couper.
- Carrelage : les tailles posées d'un même carreau de la bibliothèque (vannerie) forment une ligne, cartons recalculés
  sur le total (adaptateur `mergeTileItems`, moteur et parité inchangés).
- Parquet : une lame sans lames A et B reste une seule ligne.
- Prix : une saisie invalide garde l'ancien prix et le dit ; 0 € est un prix ; un seul message de confirmation.
- Export PDF verrouillé pendant la création.
- Fini quand : `npm run check` et e2e verts sur téléphone et ordinateur, parité intacte.
- Fait (2026-10-17).

## Lot B — Plan précis au doigt (audit UI/UX)

Branche `lot-b-plan`. Corrige PLAN-01, 02, 03, 05, 06, 08, 09, 10 (`docs/audit/PROPOSITIONS.md`).

- Vue figée pendant un glissement, cadrage repris au relâcher ; Suppr avec la confirmation d'une pièce revêtue.
- Clic sur le fond d'une fenêtre ignoré 300 ms après son ouverture (à confirmer sur téléphone).
- Obstacle placé en cotes (distance aux murs gauche et haut) ; messages d'erreur propres à chaque cas.
- Ctrl+Z / Ctrl+Y / + − 0 comme dans le calepinage ; nom d'une petite pièce réduit puis abrégé.
- Une cloison qui sépare une pièce demande le nom de la nouvelle (`Site.names`, action `plan/site/room-name`).
- Fini quand : `npm run check` et e2e verts sur téléphone et ordinateur, parité intacte.
- Fait (2026-10-17).

## Lot E — Saisie des nombres (audit UI/UX)

Branche `lot-e-nombres`. Corrige PLAN-04, UI-01, CAR-06, PIE-03 (`docs/audit/PROPOSITIONS.md`).

- Champs en 16 px réels (`--text-input` en px) ; unités de longueur dans les saisies ; refus et bornes expliqués
  sous le champ ; `soft` pour les valeurs inhabituelles ; hauteurs de zone incohérentes expliquées sous le champ.
- Fini quand : `npm run check` et e2e verts sur téléphone et ordinateur (`tests/e2e/numbers.spec.ts`).
- Fait (2026-10-17).

## Lot D — Données entre onglets et calcul bloqué (audit UI/UX)

Branche `lot-d-donnees`. Corrige ROB-01, ROB-02, ROB-04 et la moitié de PLAN-07 (`docs/audit/PROPOSITIONS.md`).

- Écriture périmée refusée entre onglets, enregistrements diffusés, éditeur ouvert prévenu (`tests/e2e/tabs.spec.ts`).
- Worker tombé : demandes rejetées, bannière « Recharger l'application ».
- Enregistrement des éditeurs aussi à la mise en arrière-plan ; plus de toast « sans connexion » sur l'écran d'erreur.
- Écarté : historique d'annulation conservé après rechargement (PLAN-07, seconde partie).
- Fini quand : `npm run check` et e2e verts sur téléphone et ordinateur.
- Fait (2026-10-17).

## Lot F — Lire une pose (audit UI/UX)

Branche `lot-f-lire-pose`. Corrige UX-01, UX-02, UX-05, PAR-03, TXT-01, CAR-04, CAR-05, BIB-01 (`docs/audit/PROPOSITIONS.md`).

- Résumé du carrelage en deux parties (« Cette pose » / « À commander, tout le projet »).
- Nom de pose proposé d'après ce qu'elle couvre (« Salle de bain, sol ») et suivi quand elle s'étend ; l'outil est
  toujours dit devant le nom (`defaultPoseName`, `core/coverage/names.ts`).
- Détail des résultats repliable par outil avec sommaire ; « chutes de coupe » et « morceaux posés » au parquet.
- Textes (« PDF de la pose »), tailles de carreau en cm, bouton Optimiser avec le zoom et « déjà optimal » dit.
- Produit utilisé : lien « Ouvrir le projet » (le remplacement est écarté).
- Fini quand : `npm run check` et e2e verts sur téléphone et ordinateur.
- Fait (2026-10-17).

## Lot H — Accessibilité et chargement (audit UI/UX)

Branche `lot-h-accessibilite`. Corrige A11Y-01, A11Y-02, A11Y-03, UI-04, PERF-01, PERF-02 (`docs/audit/PROPOSITIONS.md`).

- Titre de page par écran (« Achats — Maison · PilePoil »), titre de niveau 1 dans les éditeurs de calepinage.
- Texte à 200 % : les choix des `Segmented` passent à la ligne ; zones de toucher de 44 px sur les murs fins de l'écran
  Pièce et les liens des résultats (`tests/e2e/a11y.spec.ts`).
- Chargement : chiffres des cartes et de la vue globale calculés au repos du navigateur et gardés en cache par état du
  projet ; aperçu 3D de l'écran Projet seulement sur grand écran (une icône sur téléphone) ; hauteur réservée dans les
  résultats. Lighthouse mobile : toutes les notes ≥ 90 (projet 85 → 100, résultats du projet 84 → 90).
- PERF-02 : `html2canvas` et `purify` n'étaient déjà plus précachés (190 fichiers, 2,1 Mo) ; rien d'autre à changer.
- Fini quand : `npm run check`, e2e et `npm run lighthouse` verts.
- Fait (2026-10-17).

## Relevé rapide sur place (audit UI/UX)

Branche `releve-rapide`. Répond à PLAN-01 et PLAN-03 par le geste du métier (`docs/audit/PROPOSITIONS.md`).

- Forme « Relevé » dans « Ajouter une pièce » : murs saisis un à un (longueur, puis coin droit, rentrant ou mesuré),
  aperçu, écart de fermeture, pièce refusée au-delà de 5 cm d'écart, diagonale de contrôle (`ui/plan/SurveyForm.svelte`).
- Noyau pur `core/plan/survey.ts` (`surveyOutline`, `diagonalGap`) avec tests dont une propriété (tout rectangle ferme).
- Fini quand : `npm run check` et e2e verts (`tests/e2e/survey.spec.ts`).
- Fait (2026-10-17).

## Aide et prise en main (audit UI/UX)

Branche `aide`. Corrige AIDE-01 (`docs/audit/PROPOSITIONS.md`).

- Présentation en trois écrans au premier lancement (préférence `welcomeSeen`), seulement sur l'accueil vide ou la page
  d'aide ; rouvrable depuis « Comment ça marche » (`#/aide`).
- Glossaire (`ui/lib/glossary.ts`) et (i) `HelpTip` sur calepinage, État des lieux / Travaux, surfaces, coupes fines,
  coupes perdues, chutes.
- Écarté pour l'instant : projet d'exemple « Maison Dupont » (à faire après les niveaux et les matériaux).
- Fini quand : `npm run check` et e2e verts (`tests/e2e/help.spec.ts`).
- Fait (2026-10-17).

## N1 — Carreler une largeur d'un mur

Branche `n1-largeur-mur` (`docs/audit/PROPOSITIONS.md` §3 bis).

- Une zone de mur peut ne couvrir qu'une largeur : `wallAreaCuts` (`core/coverage/geometry.ts`) pose les quatre coupes du
  rectangle ; l'écran Pièce règle « Depuis le bord gauche » / « Jusqu'à (largeur) » à côté des hauteurs (saisies en file).
- Le reste du mur reste « sans revêtement » (pas de « Revêtir le reste » dans N1).
- Fini quand : `npm run check`, parité et e2e verts (`tests/e2e/wall-width.spec.ts`).
- Fait (2026-10-17).

## N5 — Équipements fixes du plan

Branche `n5-equipements` (`docs/audit/PROPOSITIONS.md` §3 bis).

- Six équipements s'ajoutent aux obstacles (WC, lavabo, receveur de douche, baignoire, évier / meuble, lave-linge) avec
  leur taille usuelle (`core/plan/equipment.ts`), placés en cotes depuis les murs (PLAN-05).
- Sol dessous : par défaut selon le type (WC, lavabo, lave-linge : le revêtement passe dessous ; receveur, baignoire,
  meuble : le sol est découpé), réglable par élément (`Obstacle.floorUnder`). Carrelage et parquet lisent `floorHoles`.
- Fini quand : `npm run check`, parité et e2e verts (`tests/e2e/equipment.spec.ts`, `tests/unit/equipment.test.ts`).
- Fait (2026-10-17).

## Décisions en attente
- Synchronisation entre appareils : hors périmètre pour l'instant, tout reste sur l'appareil.

Décisions prises : voir le journal de `docs/BOITE.md` §11.
