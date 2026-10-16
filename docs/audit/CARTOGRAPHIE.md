# Audit UI/UX — étape 0 : cartographie

Relevée le 2026-10-16 sur `main` (1cd0bc6), par lecture du code (`src/ui/lib/routes.ts`, `src/ui/App.svelte`,
`src/modules/*/index.ts`, écrans). Rien n'est encore testé dans un navigateur à ce stade.

## 1. Routes, écrans et états

### Routes de la coquille (`src/ui/lib/routes.ts`)
| Route | Écran | États particuliers |
|---|---|---|
| `#/` | Mes projets (`ui/screens/Home.svelte`) | vide (EmptyState + « Nouveau projet »), liste |
| `#/new` | Nouveau projet : éditeur de plan + fenêtre « Nouveau projet » (`plan/AddRoomDialog`) | projet en mémoire jusqu'à la 1re pièce |
| `#/new/:module` | Assistant d'un outil (`screens.create`) | aucun module n'en déclare : écran **vide** (à vérifier) |
| `#/library` | → redirige vers `#/library/tiles` | |
| `#/library/:lib` (`tiles`, `boards`, `paints`, `systems`) | Liste d'une bibliothèque (onglets `LibraryNav`) | vide (« Aucun carreau »…) |
| `#/library/:lib/:id`, `…/new` | Fiche produit (TileEdit, BoardEdit, PaintEdit, SystemEdit) | introuvable ; « utilisé » (suppression refusée) ; « Coller une fiche produit » (PasteSheet) |
| `#/settings` | Réglages | hors ligne, mise à jour prête, installable, données protégées |
| `#/import`, `#/import/:texte` | Importer un produit (favori) | aucune bibliothèque devinée |
| `#/demo` | Système de design (lien depuis Réglages) | |
| `#/p/:id` | Vue globale du projet (`Project.svelte`) | introuvable ; sans pièce ; « Calcul… » / « À compléter » par outil |
| `#/p/:id/plan` | Éditeur de plan (`PlanEditor`, `PlanCanvas`, `PlanPanel`) | modes : sélection, dessin, relier, cloison, démolir ; calques Existant / Travaux ; « À corriger » |
| `#/p/:id/3d` | Vue 3D du projet (`Project3D`) | sans pièce ; erreur WebGL |
| `#/p/:id/r/:room[/:surface]` | Pièce (`Room.svelte`, `room/RoomDrawing`) | introuvable ; aucune sélection ; découpe ligne / contour en cours ; dialogue « Continuer / Nouvelle pose » |
| `#/p/:id/resultats`, `#/p/:id/r/:room/resultats`, `#/p/:id/pose/:pose/resultats` | Résultats (`Results.svelte`), onglets Résumé / Détail / 3D | introuvable ; « Rien à calculer ici » ; calcul échoué (Réessayer) ; PDF en cours / fait / partagé / échec |
| `#/p/:id/achats` | Achats (`Shopping.svelte`) | introuvable ; « Rien à acheter » ; articles sans prix |
| `#/p/:id/m/:module/…` | Écrans des modules (ci-dessous) | |
| `#/p/:id/m/:module/results` | **ancienne adresse** → redirige vers `#/p/:id/resultats` | |
| tout le reste | « Page introuvable » | |

### Écrans des modules (`#/p/:id/m/<module>/…`)
| Module | Chemin | Écran |
|---|---|---|
| carrelage | `` (vide) | `ToProject` : redirige vers la vue globale |
| carrelage | `s/:surfaceId` (en fait un id de **pose**, `poseHref`) | Calepinage carrelage (`EditorScreen` → `editor/Editor.svelte`, coquille `ui/calepinage/PoseEditorShell`) : vues Plan / Rendu / 3D, zoom, étapes Produit, Pose, Découpage, Finitions, Avancé, alertes, optimisation |
| carrelage | `compare` | Comparer A/B (`Compare.svelte`) |
| parquet | `` et `pose/:poseId` | Calepinage parquet (`ParquetEditor`) ; sans pièce ; sans pose |
| peinture | `` et `pose/:poseId` | Pose de peinture (`PeintureEditor`, `TintPicker`, `WallsElevation`) ; sans mur ; sans pose |
| cloisons | `` | Cloisons (`CloisonsEditor`, `CloisonsSettingsForm`) ; pas de cloison |
| cloisons | `c/:partitionId` | Élévation et fiche de coupe (`ElevationScreen`) |

### États globaux
- Chargement : « Chargement… » (`App.svelte`) tant que la base et la logique des modules ne sont pas prêtes.
- Erreur fatale : « Impossible d'ouvrir vos données » (IndexedDB indisponible, navigation privée) ; échec de
  chargement d'un morceau : « Rechargez la page ».
- Enregistrement impossible : toast persistant avec « Réessayer » (`app.trySaveProject`, `tryWrite`).
- Échec de calcul : `ComputeFailed` (garde le résultat d'avant, « Réessayer ») ; filet `unhandledrejection`.
- PWA : toasts « Une nouvelle version est disponible », « PilePoil fonctionne maintenant sans connexion ».
- Annulation : toasts « Annuler » (suppression de projet 6,5 s, zone retirée, revêtement changé, prix).

### Modales, panneaux, menus
Nouveau projet / Ajouter une pièce (formes Rectangle, En L, En U, Dessin ; emplacement « contre … mur n ») ;
Renommer le projet ; Nommer la pièce ; « Des revêtements seront réduits » ; « Supprimer la pièce ? » ; menu
« ⋯ » d'une carte projet (Renommer, Dupliquer, Supprimer) ; « Continuer / Nouvelle pose » ; « Carreau / Lame /
Peinture / Système utilisé » ; « Charger le scénario ? » ; « Supprimer la zone ? » (démo) ; PasteSheet ;
SurfaceDialog (carrelage) ; BottomSheet à 3 crans (plan, calepinage) ; inspecteur latéral ≥ 1024 px.

## 2. Actions par écran

| Écran | Actions |
|---|---|
| Mes projets | Nouveau projet ; Bibliothèques ; Réglages ; ouvrir un projet ; menu ⋯ (Renommer, Dupliquer, Supprimer + Annuler) **seulement sur la carte d'un projet avec carrelage** (`Home.svelte:12`, seul le carrelage fournit `screens.card`) ; lien « Importez vos données » (état vide) |
| Nouveau projet / Ajouter une pièce | nom du projet, forme, nom, longueur, largeur, retraits / ailes / encoche, emplacement ; Ajouter ; Annuler ; Dessin libre |
| Plan | Retour ; Renommer ; Annuler ; Rétablir ; Ajouter une pièce ; Voir tout le plan ; toucher = sélection (pièce, point, mur, ouverture, obstacle, passage, cloison, démolition) ; glisser un coin, une ouverture, la vue ; pincer ; molette ; Échap ; Suppr / Retour arrière (supprime la sélection) ; panneau : Toutes les pièces, nom, hauteur sous plafond, épaisseur, côté de l'épaisseur, murs (longueur), Ajouter un point au milieu, Ajouter une porte / fenêtre / baie / obstacle, Relier à une autre porte, Supprimer la pièce, Choisir les revêtements, Terminer la pièce / Annuler le dessin ; calque Travaux : Verrouiller les murs extérieurs, verrou par mur, Cloison, Démolir un mur, Tous les travaux, Supprimer la cloison ; listes « À corriger » |
| Vue globale | Retour ; Modifier le plan ; Résultats du projet ; toucher une pièce (plan ou liste) ; ouvrir une pose ; Résultats de la pièce ; Vue 3D ; carte d'un outil ; Achats ; Ajouter une pièce |
| Pièce | Retour ; Modifier le plan ; Résultats de la pièce ; toucher le sol ou un mur (dessin, clavier Entrée/Espace, liste) ; Revêtir : carrelage / parquet / peinture ; Continuer « pose » / Nouvelle pose ; Calepinage / Réglages ; Découper par une ligne ; Découper par un contour (points, Fermer, Retirer le dernier point, Annuler) ; Depuis le sol / Jusqu'à (zone de mur) ; Revêtir la partie libre ; Passer en … ; Retirer (+ Annuler) |
| Calepinage carrelage | Annuler / Rétablir (Ctrl+Z, Ctrl+Y) ; Pièce ; Résultats ; Plan / Rendu / 3D ; Zoomer, Dézoomer, Ajuster (+, −, 0, flèches, Échap) ; pincer, glisser, molette ; Surface / Pièce en 3D ; étapes ; Produit : Nouveau carreau, Modifier ce carreau, Copier / Coller sur cette zone, Appliquer à toutes les bandes, joint, couleur du joint, mélange, variation, pose debout ; Pose : motif (grille au clavier), orientation, départ, décalages, priorité, Optimiser / Arrêter, Toutes les bandes ; Découpage : bandes (Ajouter, réordonner, frise type), réservations, ouvertures, tableaux, Modifier le plan ; Finitions : bords, plinthes, jonctions ; Avancé : perte, chute mini, casse, numéros de coupe |
| Calepinage parquet | lame, Gérer les lames, motif, mode de pose, décalages, jeu, coupe mini, rang de bord, plinthes, sous-couche, pare-vapeur, barres, seuils (Poser ce seuil, tracé à la main, Annuler le tracé), Séparer en deux poses, marge d'achat, nom de la pose, Optimiser / Arrêter, vue du plan (flèches) |
| Pose de peinture | peinture, couches, support, état, apprêt, enduit, teintes murs / boiseries, faces, portes, huisseries, plinthes, déductions, perte, consommables, Gérer les peintures, Ouvrir la pièce |
| Cloisons | Annuler / Rétablir ; système, hauteur, entraxe, plaques A/B, isolant, renforts, montants doublés, hauteur des pièces voisines ; Voir l'élévation ; Liste d'achat ; PDF des cloisons ; Résultats du projet ; Élévation : couche, fiche de coupe |
| Résultats | onglets Résumé / Détail / 3D ; Télécharger le PDF ; Partager ; Réessayer ; fil Projet › … ; Calepinage ; Achats ; 3D : Murs (Pleins / Bas / Coupés), Point de vue, Rapprocher / Éloigner, glisser, flèches |
| Vue 3D | toucher une pièce, encore = ouvrir ; liste des pièces ; mêmes commandes 3D |
| Achats | prix unitaire par ligne (+ Annuler) ; Exporter en PDF ; Exporter pour un tableur (CSV) |
| Bibliothèques | onglets Carreaux / Lames / Peintures / Cloisons ; Ajouter ; ouvrir ; fiche : champs, photo (PhotoPicker), Coller une fiche produit, Dupliquer (sauf carreau), Supprimer (refusé si utilisé), Revenir |
| Comparer | Enregistrer l'état actuel (A/B), nom, Charger (confirmation, Garder l'état actuel), Remplacer par l'actuel, Effacer |
| Réglages | Thème ; Épaisseur des murs ; Envoyer à PilePoil (glisser), Copier le favori, Coller une fiche ; Rechercher une mise à jour / Mettre à jour maintenant ; Installer ; Voir le système de design |
| Importer | choix de la bibliothèque ; Continuer ; Réglages |

## 3. Implémenté ou non, par rapport à `docs/PLAN.md`

Le dépôt a dépassé le périmètre décrit dans la consigne (S1–S3, P1–P5) : sont aussi faits C1–C4, N0–N5,
PE0–PE4, T0, CL1–CL3, F1, B1, B2.

Fait et audité : socle S1–S3, parquet P1–P4 et P5 sans chantier, carrelage sur le plan, parcours N0–N5,
peinture PE1–PE4, plan v3 avec travaux (T0), cloisons CL1–CL3, fiabilité F1, bibliothèques B1, teintes B2.

N'existe pas (non audité, listé) :
- **import legacy et migration v1 → v2** : retirés en C4 (aucune conversion, base repartie de zéro). Reste
  pourtant un lien « Importez vos données » sur l'accueil vide (`Home.svelte:30`) → à constater.
- **mode chantier** (parquet) : retiré le 2026-10-15 ; pas de mode chantier carrelage.
- **plafonds** (PE5), synchronisation entre appareils.
- **recherche et tri des projets** : absents (tri par date de modification seulement).
- **assistant `#/new/:module`** : route présente, aucun module ne fournit `screens.create`.
- **aide** : pas d'écran d'aide ; Réglages contient « À propos » et le lien vers le système de design.
- **appareil photo** : photo de carreau seulement par fichier (PhotoPicker), pas de relevé photo de chantier.

Écarts documents ↔ code déjà vus (à confirmer en test, sans trancher) :
- `docs/UX.md` (navigation, assistant 4 étapes, onglets Commande / Découpe / Achats / Encollage) décrit
  l'ancienne application ; le code suit `docs/NAVIGATION.md` (Résumé / Détail / 3D, pas d'assistant).
- `docs/UX.md` : « champs avec +/− » ; à vérifier sur `NumberField`.
- `docs/UX.md` : « Accueil : vignette 3D, m², coût » ; seule la carte d'un projet avec carrelage a une vignette.
- Consigne « 2,4 m » : `ui/lib/calc.ts` n'accepte pas d'unité dans la saisie.
- Réglages « À propos » : « calepinage du carrelage » seulement, sans parquet, peinture ni cloisons.

## 4. Scénarios (89)

Identifiants repris dans `tests/audit/` et dans les constats.

**A. Premier contact (3)** — A1 premier lancement, accueil vide, compréhension en 5 s ; A2 manifeste, icônes,
couleur de thème, service worker ; A3 hors ligne après premier chargement.

**B. Projets (8)** — B1 créer (rectangle) ; B2 créer en L, en U, en dessin libre ; B3 renommer (carte, plan) ;
B4 dupliquer ; B5 supprimer, annuler, fermer l'onglet pendant le délai ; B6 projet sans carrelage : actions de
l'accueil ; B7 25 projets, noms longs, emoji, vides ; B8 lien « ancienne version ».

**C. Plan (14)** — C1 rectangle / L / U ; C2 expressions (« 2400+600 », « 2,4 », « 2,4 m », « 240-12 », vide,
collage) ; C3 dessin libre, fermeture, nommage ; C4 contour croisé, < 3 points, aire nulle ; C5 obstacle (dont
hors pièce) ; C6 portes, fenêtres, baies (dont hors mur) ; C7 seconde pièce, portes reliées, passage incohérent ;
C8 déplacer un coin, ajouter un point, aimantation, grille ; C9 pincer, glisser, molette, voir tout ; C10
panneau à 3 crans et au clavier ; C11 annuler / rétablir chaque action, puis après rechargement ; C12 supprimer une
pièce revêtue (bouton et touche Suppr) ; C13 calque Travaux (verrou, cloison, démolir, porte, surface perdue) ;
C14 épaisseur des murs, hauteur sous plafond.

**D. Pièce et zones (6)** — D1 sélection au dessin, au clavier, en liste ; D2 revêtir avec chaque outil, parquet
sur un mur ; D3 continuer une pose voisine ; D4 découper un sol (ligne, contour) ; D5 zone de mur et partie
libre ; D6 changer de revêtement, retirer, annuler.

**E. Carrelage (10)** — E1 Produit ; E2 chaque motif, orientation, départ, décalage ; E3 optimiser, arrêter ;
E4 Découpage (bandes, réservations, ouvertures, tableaux) ; E5 Finitions et Avancé ; E6 vues Plan / Rendu / 3D ;
E7 quantités et coupes recalculées à la main ; E8 Comparer A/B ; E9 murs qui se suivent, sols reliés ; E10 PDF
ouvert et lu.

**F. Parquet (7)** — F1 lame, chaque motif, angle ; F2 axe, mur de référence, règles ; F3 alertes ; F4
optimisation ; F5 deux pièces, seuils, séparer ; F6 quantités recalculées à la main ; F7 PDF.

**G. Peinture (4)** — G1 murs, produit, couches, teintes ; G2 boiseries, plinthes, déductions ; G3 litres et
pots recalculés à la main ; G4 au-dessus d'une crédence.

**H. Cloisons (3)** — H1 tracer, système, hauteur ; H2 élévation, fiche de coupe ; H3 rails, montants,
plaques recalculés à la main.

**I. Résultats et 3D (4)** — I1 trois niveaux, onglets ; I2 vue 3D, murs, sélection, liste ; I3 dossier PDF du
projet ; I4 partage.

**J. Achats et bibliothèques (7)** — J1 liste consolidée des quatre outils ; J2 prix modifiés, totaux ; J3 PDF
ouvert et vérifié ; J4 CSV ouvert et vérifié ; J5 créer, modifier, dupliquer, supprimer dans chaque
bibliothèque ; J6 supprimer un produit utilisé ; J7 coller une fiche, `#/import`.

**K. Réglages et aide (2)** — K1 thème, épaisseur, favori, mise à jour, version ; K2 à propos, aide, démo.

**L. Robustesse (12)** — L1 valeurs limites (0, négatif, décimales, 100 m, 1 mm, vide, texte collé) ; L2
rechargement en pleine saisie ; L3 retour navigateur / Android sur chaque écran ; L4 liens profonds, identifiants
inconnus, anciennes adresses ; L5 rotation pendant l'édition ; L6 arrière-plan puis reprise ; L7 deux onglets ;
L8 double tap et taps répétés ; L9 IndexedDB indisponible, stockage plein ; L10 mise à jour du service worker
projet ouvert ; L11 3G lent et CPU ×4 ; L12 calcul en échec.

**M. Performance (5)** — M1 durée de calcul (petit, moyen, gros) ; M2 réactivité pendant le calcul (tâches
longues) ; M3 Lighthouse sur chaque écran principal, mobile et ordinateur ; M4 taille du bundle ; M5 i/s en 3D.

**N. Transverses (4)** — N1 tour des écrans (capture, axe-core, cibles, débordements, champs < 16 px, contraste)
en clair et en sombre ; N2 clavier seul (ordre, focus visible, pièges) ; N3 zoom 200 % et police agrandie ; N4
mouvement réduit.

## 5. Matrice retenue

Projets Playwright (29) :
- téléphones (16) : 360 × 740, 375 × 667, 390 × 844, 430 × 932 ; portrait et paysage ; Chromium et WebKit ;
  `isMobile`, `hasTouch` ;
- tablettes (4) : 768 × 1024, 1024 × 1366 ; portrait et paysage ; tactiles ;
- ordinateur (9) : 1280 × 800, 1440 × 900, 1920 × 1080 ; Chromium, Firefox, WebKit.

Paliers d'exécution (pour rester dans un temps raisonnable) :
1. **Tous les scénarios A–L** sur les deux appareils de référence : téléphone 390 × 844 Chromium et ordinateur
   1280 × 800 Chromium ; les scénarios tactiles du plan et des champs aussi sur 390 × 844 WebKit.
2. **N1 (tour des écrans) et le parcours clé** (nouveau projet → pièce → carrelage → résultats → achats) sur
   les 29 projets.
3. **Conditions** sur les deux appareils de référence : sombre, mouvement réduit, zoom 200 % et police agrandie
   (Firefox), hors ligne, 3G lent + CPU ×4 (Chromium, CDP) ; clavier seul sur les trois moteurs d'ordinateur ;
   `fr-FR` et `Europe/Paris` partout.

Limites connues de l'émulation (détail dans `MATRICE.md`) : WebKit sous Windows n'est pas Safari iOS (ni
clavier virtuel, ni zoom au focus, ni encoche, ni installation) ; le retour Android est simulé par
`history.back()` ; l'installation, le plein soleil, les gants et les performances réelles vont dans
`A_TESTER_SUR_TELEPHONE.md`.
