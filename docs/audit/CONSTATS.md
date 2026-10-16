# Constats détaillés

Source : `tests/audit/constats.ts` (régénère ce fichier et `constats.csv`).

## P0 (0)

## P1 (6)

### PRJ-01 — Mes projets #/

**UX** · tous (29)

Un projet sans carrelage (parquet, peinture ou cloisons seuls, ou sans revêtement) n’a aucun menu sur l’accueil : impossible de le renommer depuis l’accueil, de le dupliquer ou de le supprimer, et aucun autre écran ne supprime un projet.

- Preuve : docs/audit/captures/accueil/tel-390x844-portrait-chromium/B6-sans-carrelage.jpg ; docs/audit/captures-local/mesures/B6/*.json (menu: 0)
- Reproduire : Nouveau projet → pièce → Revêtir : parquet → revenir à l’accueil : la carte n’a pas de bouton ⋯.
- Cause probable : src/ui/screens/Home.svelte:12 (carte = premier outil qui fournit screens.card, seul le carrelage en fournit une) ; menu dans src/modules/carrelage/ui/components/ProjectCard.svelte:68-107
- Recommandation : Carte de projet commune dans la coquille (nom, date, m² par outil, coût) avec le menu Renommer / Dupliquer / Supprimer pour tous les projets ; la vignette du module devient un enrichissement facultatif.

### PLAN-01 — Plan #/p/:id/plan

**UX** · tous (souris et toucher)

Glisser un coin de pièce le déplace bien plus loin que le doigt (×2 à ×3) : 33 × 21 px de geste font passer une pièce de 12 m² à 25 m² (murs de 767 et 913 cm au lieu d’environ 400) sur téléphone, 15 m² sur ordinateur. La pièce perd ses angles droits sans que l’utilisateur l’ait voulu.

- Preuve : docs/audit/captures/plan/tel-390x844-portrait-chromium/C8-coin-deplace.jpg ; docs/audit/captures-local/mesures/C8/*.json
- Reproduire : Nouveau projet 400 × 300 → toucher la pièce → glisser un coin de quelques millimètres.
- Cause probable : src/ui/plan/PlanCanvas.svelte:32-38 : tant que la vue n’a pas été bougée (userView null), le cadrage est recalculé depuis les limites du plan à chaque modification, donc pendant le glissement (l.143-151) : la conversion écran → plan change sous le doigt.
- Recommandation : Figer la vue au début d’un glissement (userView = view au pointerdown) et ne recadrer qu’au relâcher, ou sur « Voir tout ».

### PLAN-02 — Plan #/p/:id/plan

**robustesse** · ordinateur et tablette avec clavier

La touche Suppr (ou Retour arrière) supprime la pièce sélectionnée et ses poses sans la confirmation que demande le bouton « Supprimer la pièce » (« « Salle de bain » a des revêtements qui seront perdus… »). L’annulation n’existe que tant que l’historique est en mémoire (perdu au rechargement, PLAN-07).

- Preuve : docs/audit/captures/plan/pc-1280x800-chromium/C12-apres-suppr.jpg ; docs/audit/captures/plan/pc-1280x800-chromium/C12-confirmer-suppression.jpg ; docs/audit/captures-local/mesures/C12/pc-1280x800-chromium.json
- Reproduire : Plan du projet maison → toucher « Salle de bain » dans la liste → cliquer le dessin → Suppr : la pièce et les poses 5 et 6 disparaissent sans question.
- Cause probable : src/ui/plan/PlanCanvas.svelte:289-291 appelle st.removeRoom directement ; le bouton passe par askRemove (src/ui/plan/PlanPanel.svelte:540).
- Recommandation : Faire passer le raccourci par la même confirmation que le bouton quand la pièce porte des revêtements.

### ACH-01 — Achats #/p/:id/achats et PDF des achats

**métier** · tous (29)

Les lignes « Rail R48 — barre de 3 m » et « Montant M48 — barre de 2,5 m » n’affichent aucune quantité (« Cloisons · » puis rien), ni à l’écran ni dans le PDF : on ne sait pas combien en acheter. Le CSV, lui, donne 3 rails et 10 montants (justes : 2 × 400 cm de rail en barres de 3 m ; 2 + 6 + 2 montants à 60 cm d’entraxe).

- Preuve : docs/audit/captures/achats/tel-390x844-portrait-chromium/N1-light.jpg ; docs/audit/captures-local/mesures/J1/*.json (quantites-vides) ; docs/audit/captures-local/mesures/J3, J4
- Reproduire : Projet maison → Achats : groupe « Ossature et plaques ».
- Cause probable : src/modules/cloisons/state/module.ts:51-67 (lignes sans `detail`) et src/ui/screens/Shopping.svelte:100, src/ui/lib/shoppingPdf.ts:21 (seul `detail` est affiché, jamais `quantity` avec son unité).
- Recommandation : Afficher toujours la quantité et l’unité d’achat (« 3 barres ») dans l’écran et le PDF, le détail en complément ; donner un détail aux rails et montants (« 8 m, barres de 3 m »).

### CAR-01 — Calepinage carrelage, motif Vannerie ; Achats

**métier** · tous (29)

En vannerie, la liste d’achat sépare le carreau en deux produits : « 20 × 10 cm » (33 cartons) et « 20 × 9,9 cm » (15 cartons), ce dernier n’existe pas en magasin et n’a pas de prix. Le total estimé tombe de 585 € à 411 € alors que le nombre de carreaux augmente.

- Preuve : docs/audit/captures/achats/pc-1280x800-chromium/E2-vannerie.jpg ; docs/audit/captures-local/mesures/E2/pc-1280x800-chromium.json (vannerie)
- Reproduire : Projet maison → calepinage du sol de la salle de bain → Pose → Vannerie → Achats.
- Cause probable : Règle voulue (docs/carrelage/DOMAIN.md:20 : largeur ramenée à S/n − j) mais les achats regroupent par taille posée (src/modules/carrelage/core/shopping/items.ts:48, clé tile|<taille>) au lieu du produit de la bibliothèque. Moteur sous parité legacy.
- Recommandation : Regrouper les lignes par carreau de la bibliothèque dans l’adaptateur d’achats (src/modules/carrelage/state/module.ts:117-141), sans toucher au moteur : la parité (tests/parity/parity.test.ts:216) compare les clés du moteur. La largeur ramenée reste une recoupe, à signaler dans la fiche de coupe.

### ROB-01 — Deux onglets sur le même projet

**robustesse** · ordinateur (surtout)

Avec le plan ouvert dans un onglet et les achats dans un autre, le nom de pièce changé dans le premier est écrasé sans message par l’enregistrement du second (dernier qui écrit gagne). Le second onglet ne voit pas la modification du premier.

- Preuve : docs/audit/captures-local/mesures/L7/tel-390x844-portrait-chromium.json (final.pieces = Séjour, onglet-B-voit-A = false)
- Reproduire : Onglet A : plan, renommer « Séjour » ; onglet B (ouvert avant) : Achats, saisir un prix ; recharger : le nom est revenu à « Séjour ».
- Cause probable : src/ui/lib/app.svelte.ts:88-92 : l’état des projets est chargé une fois par onglet, aucune synchronisation entre onglets (BroadcastChannel, storage event) ni contrôle de version à l’écriture.
- Recommandation : Diffuser chaque enregistrement aux autres onglets (BroadcastChannel) et refuser une écriture dont la base a changé (updatedAt) en proposant de recharger.

## P2 (25)

### PLAN-03 — Plan, dessin libre (#/new, Ajouter une pièce → Dessin)

**UX** · téléphones et tablettes (toucher), Chromium et WebKit

Au toucher, toucher le premier point pour fermer la pièce (consigne affichée) ne fait rien : la fenêtre « Nommer la pièce » s’ouvre et se referme aussitôt. À la souris, elle reste ouverte. Contournement : « Terminer la pièce ».

- Preuve : docs/audit/captures/echecs/tel-390x844-portrait-chromium/B2-echec-dessin-creer.jpg ; docs/audit/captures-local/mesures/B2/*.json (dessin:fenetre-nom false au toucher, true à la souris)
- Reproduire : Nouveau projet → Dessin → toucher 4 coins puis le premier.
- Cause probable : Probable « clic fantôme » : la fenêtre s’ouvre au pointerup (src/ui/plan/PlanCanvas.svelte:213-226 → planState.svelte.ts:471-476), le clic synthétique qui suit le toucher tombe sur son fond et la ferme (Dialog onclose, src/ui/plan/PlanEditor.svelte:188). À confirmer sur un vrai téléphone.
- Recommandation : Ouvrir la fenêtre au clic (ou après le cycle d’événements), ou ignorer un clic sur le fond dans les 300 ms qui suivent l’ouverture.

### PLAN-04 — Plan, saisie des cotes (tous les NumberField)

**UX** · tous (29)

Les cotes sont en centimètres sans le dire dans la saisie : « 2,4 » devient un mur de 2,4 cm, accepté sans alerte ; « 2,4 m » ou « 240 cm » sont refusés en silence (la valeur précédente revient, seul aria-invalid change) ; « 0 », « -50 » deviennent 1 cm sans message ; 100 m de mur ou 1 km de hauteur sous plafond sont acceptés.

- Preuve : docs/audit/captures/plan/tel-390x844-portrait-chromium/C2-saisie-abc.jpg ; docs/audit/captures-local/mesures/C2, C14, L1
- Reproduire : Plan → pièce → Mur 1 : taper 2,4 m puis Entrée ; taper 2,4 ; taper 0.
- Cause probable : src/ui/lib/calc.ts:5 (pas d’unité dans les expressions) ; src/ui/components/NumberField.svelte:57 (valeur invalide ignorée, bornes appliquées sans message).
- Recommandation : Accepter les unités (« 2,4 m », « 240 cm », « 2400 mm ») ; message sous le champ quand la saisie est refusée ou bornée ; alerte de vraisemblance (mur < 20 cm ou > 30 m, hauteur > 6 m).

### PLAN-05 — Plan, obstacle

**a11y** · tous (29)

Un obstacle n’a ni position ni distance au mur dans le panneau (seulement Type, Largeur, Profondeur) : il ne se place qu’en le glissant. Impossible au clavier et imprécis au doigt ; docs/UX.md promet « le panneau permet tout sans pointeur ».

- Preuve : docs/audit/captures/plan/tel-390x844-portrait-chromium/C5-obstacle.jpg ; docs/audit/captures-local/mesures/C5/*.json (position-reglable: 0)
- Reproduire : Plan → pièce → Ajouter un obstacle.
- Cause probable : src/ui/plan/PlanPanel.svelte:385-416
- Recommandation : Ajouter « Distance au mur gauche / au mur du haut » (cotes) à l’obstacle, comme pour les ouvertures.

### PIE-01 — Pièce, découpe du sol

**UX** · téléphones surtout

Pendant « Découper par une ligne », toucher juste au bord du sol tombe sur un mur déplié : la découpe est abandonnée sans message et le mur est sélectionné, alors que la consigne dit « d’un mur à l’autre ». Dans l’angle rentrant d’un L, les murs 3 et 4 dépliés se chevauchent.

- Preuve : docs/audit/captures/piece/tel-390x844-portrait-chromium/D4-decoupe-ligne-faite.jpg
- Reproduire : Pièce salle de bain (L) → Sol → Découper par une ligne → toucher le haut du sol puis le bas, au ras du bord.
- Cause probable : src/ui/screens/Room.svelte:71-74 (select() remet cutting à null) ; dessin des murs dépliés dans src/ui/room/RoomDrawing.svelte:120-140.
- Recommandation : En mode découpe, ignorer la sélection d’un mur et aimanter le point au bord du sol ; décaler les murs dépliés qui se chevauchent.

### ROB-02 — Tous les écrans de calcul

**robustesse** · tous (29)

Si le moteur de calcul ne se charge pas (fichier du worker en erreur, cache abîmé), tout reste sur « Calcul… » indéfiniment : vue globale, calepinage, achats. Pas de message ni de « Réessayer », alors que ComputeFailed existe pour un calcul en erreur.

- Preuve : docs/audit/captures/projet/tel-390x844-portrait-chromium/L12-calcul-echec.jpg ; docs/audit/captures/calepinage-carrelage/tel-390x844-portrait-chromium/L12-calcul-echec.jpg
- Reproduire : Bloquer le fichier compute.worker (outils de développement) puis ouvrir un projet.
- Cause probable : src/workers/client.ts : pas de gestion de l’événement error du Worker ni de délai de réponse.
- Recommandation : Écouter worker.onerror et un délai maximal ; afficher ComputeFailed avec « Recharger l’application ».

### UI-01 — Tous les formulaires (TextField, Select, prix des achats)

**UI** · iPhone et iPad (Safari)

Les champs texte, les listes et les prix des achats sont en 14 px : Safari iOS zoome à chaque saisie (nom du projet, nom de pièce, système de cloison, peinture, 18 prix des achats). docs/UX.md et docs/IDENTITE.md imposent 16 px minimum ; seuls les champs numériques (NumberField) y sont.

- Preuve : docs/audit/mesures/controles.md (colonne champs < 16 px) ; à vérifier sur iPhone (A_TESTER_SUR_TELEPHONE.md)
- Reproduire : Sur iPhone : Nouveau projet → toucher « Nom du projet ».
- Cause probable : src/ui/design/typo.css:8 met 14 px sur html, et --text-input vaut 1rem (src/ui/design/tokens.css:66, commentaire « 16 px mini ») : 1rem = 14 px. Appliqué par src/ui/design/base.css:49-52.
- Recommandation : Exprimer --text-input en px (16 px) ou en rem calculé sur 16 px ; garder le test de contraste et ajouter un test « champs ≥ 16 px ».

### UI-02 — Calepinage parquet (téléphone)

**UI** · téléphones portrait

La liste « Lame » de l’étape Produit dépasse à droite de l’écran (468 px dans 390 px) ; le bord et la flèche sont coupés. Le plan des lames n’a ni cotes ni boutons de zoom ni vues Plan / Rendu / 3D, contrairement au carrelage, alors que NAVIGATION.md promet la même coquille.

- Preuve : docs/audit/captures/calepinage-parquet/tel-390x844-portrait-chromium/N1-light.jpg
- Reproduire : Projet maison → Séjour → Sol → Calepinage (téléphone).
- Cause probable : src/modules/parquet/ui/components/ParquetEditor.svelte:222 (Select sans largeur maximale) ; outils de vue absents de ParquetPlan.svelte.
- Recommandation : Select à 100 % de largeur ; reprendre les outils de vue (cotes, zoom, ajuster) de la coquille commune.

### UI-03 — Calepinage et plan en paysage (téléphone)

**UI** · téléphones en paysage (7 appareils sur 8) ; « Voir tout le plan » trop petit en paysage 375 × 667 et 360 × 740 (axe target-size)

En paysage, le panneau tiré garde la mise en page portrait : à mi-hauteur il laisse environ 150 px au dessin, les outils flottants (Plan / Rendu / 3D, zoom) recouvrent la cote « 300 cm » et le coin du dessin, la consigne du panneau passe sous le résumé, à moitié coupée ; les réglages de l’étape ne sont pas visibles sans agrandir le panneau, qui cache alors tout le dessin.

- Preuve : docs/audit/captures/calepinage-carrelage/tel-360x740-paysage-chromium/E1-produit.jpg ; docs/audit/captures/calepinage-carrelage/tel-360x740-paysage-chromium/E6-vue-Plan.jpg
- Reproduire : Téléphone en paysage → calepinage du sol de la salle de bain.
- Cause probable : src/ui/calepinage/PoseEditorShell.svelte:83-86 : mise en page « ordinateur » (panneau à droite) seulement à partir de 1024 px de large ; idem src/ui/plan/PlanEditor.svelte:79.
- Recommandation : Panneau latéral dès que la largeur dépasse la hauteur et 640 px (paysage), outils en colonne à gauche comme sur ordinateur.

### UX-01 — Calepinage carrelage, barre de résumé

**UX** · tous (29)

La barre de résumé d’une pose affiche les totaux de tout le carrelage du projet : « 1171 carreaux · 585,15 € » pour un sol de 6,7 m² (347 carreaux posés). Rien ne dit qu’il s’agit du projet ; le chiffre ne bouge presque pas quand on change le motif de la pose.

- Preuve : docs/audit/captures/calepinage-carrelage/tel-390x844-portrait-chromium/N1-light.jpg ; docs/audit/captures/resultats-pose/tel-390x844-portrait-chromium/N1-light.jpg
- Reproduire : Projet maison → Salle de bain → Sol → Calepinage.
- Cause probable : Choix assumé (docs/NAVIGATION.md §7 : chutes partagées sur le projet) mais résumé du module sans libellé ; src/modules/carrelage/ui/editor/Editor.svelte (summary).
- Recommandation : Résumé en deux parties : « Cette pose : 347 carreaux posés, 51 coupes » puis « À commander (tout le projet) : 47 cartons ».

### UX-02 — Vue globale, Pièce, listes de poses

**texte** · tous (29)

Les poses sont numérotées pour tout le projet, tous outils confondus (« Peinture · Pose 3 », « Carrelage · Pose 5 ») ; la liste « Sol et murs » de l’écran Pièce n’affiche même pas l’outil (« Mur 1 : Pose 2, Pose 3 »). L’artisan pense « crédence », « sol de la salle de bain ».

- Preuve : docs/audit/captures/piece/tel-390x844-portrait-chromium/N1-light.jpg ; docs/audit/captures/projet/pc-1280x800-chromium/N1-light.jpg
- Reproduire : Projet maison → Séjour.
- Cause probable : Nom par défaut « Pose n » (src/ui/room/cover.ts) ; liste dans src/ui/screens/Room.svelte:374-377.
- Recommandation : Nom par défaut descriptif (« Carrelage — Salle de bain, sol ») et l’outil toujours affiché ; renommage proposé.

### UX-03 — Comparer #/p/:id/m/carrelage/compare

**UX** · tous (29)

L’écran « Comparer » (scénarios A/B) existe et fonctionne mais aucun lien n’y mène (ni vue globale, ni calepinage, ni résultats) : fonction invisible.

- Preuve : docs/audit/captures/comparer/tel-390x844-portrait-chromium/N1-light.jpg ; docs/audit/captures-local/mesures/E8/*.json (liens-vers-comparer 0)
- Reproduire : Chercher « Comparer » dans l’application.
- Cause probable : Route déclarée dans src/modules/carrelage/index.ts:54, aucun lien depuis les écrans N3–N5.
- Recommandation : Lien « Comparer deux réglages » dans le menu de la pose (titre) ou les résultats ; sinon retirer l’écran.

### UX-04 — Mes projets (accueil vide)

**UX** · tous (29)

L’accueil vide invite : « Vous utilisiez l’ancienne version ? Importez vos données. » Le lien mène aux Réglages, où il n’y a plus d’import (retiré en phase C4) : cul-de-sac. Le même texte reste affiché quand le stockage est plein.

- Preuve : docs/audit/captures/reglages/tel-390x844-portrait-chromium/A1-depuis-lien-import.jpg ; docs/audit/captures-local/mesures/A1/*.json
- Reproduire : Premier lancement → lien « Importez vos données ».
- Cause probable : src/ui/screens/Home.svelte:30
- Recommandation : Retirer la phrase (docs/PLAN.md C4) ou la remplacer par une aide de démarrage.

### PRJ-02 — Mes projets, carte d’un projet mixte

**UX** · tous (29)

La carte d’un projet avec carrelage ne montre que le carrelage : « 3 surfaces · 21,96 m² » alors que la vue globale annonce 23,42 m² de carrelage, 11,6 m² de parquet, etc. ; la vignette est la première surface carrelée (une crédence), pas le plan. Les autres projets n’ont ni vignette ni chiffres.

- Preuve : docs/audit/captures/accueil/tel-390x844-portrait-chromium/N1-light.jpg ; docs/audit/captures/accueil/tel-390x844-portrait-chromium/B6-sans-carrelage.jpg
- Reproduire : Projet maison → Mes projets.
- Cause probable : src/modules/carrelage/ui/components/ProjectCard.svelte:31-66 (projectArea, première surface).
- Recommandation : Carte commune (PRJ-01) : vignette du plan, pièces, résumé par outil, coût total.

### PRJ-03 — Mes projets, suppression

**robustesse** · tous (29)

Supprimer un projet ne demande rien (annulable 6,5 s) ; si l’onglet ou l’application est fermé pendant ce délai, la suppression n’est jamais écrite : le projet revient au lancement suivant.

- Preuve : docs/audit/captures-local/mesures/B5/*.json (apres-fermeture: projets 1)
- Reproduire : Accueil → ⋯ → Supprimer → fermer l’onglet tout de suite → rouvrir.
- Cause probable : src/ui/lib/app.svelte.ts:157-176 (effacement dans un setTimeout, rien au pagehide).
- Recommandation : Écrire la suppression au pagehide (ou marquer le projet « à supprimer » tout de suite et l’effacer au démarrage suivant).

### PAR-01 — Calepinage parquet, motifs bâton rompu et Hongrie ; Achats

**métier** · tous (29)

Avec une lame sans variantes A et B (stratifié), le bâton rompu commande « Stratifié (lames A) : 268 lames » et « (lames B) : 269 lames » : deux références qui n’existent pas. L’avertissement « Cette lame n’a pas de lames A et B » n’empêche rien.

- Preuve : docs/audit/captures/calepinage-parquet/pc-1280x800-chromium/M1-hongrie-120m2.jpg ; docs/audit/captures-local/mesures/F3/*.json
- Reproduire : Pièce 12 × 10 m → parquet stratifié → Bâton rompu → Résultats.
- Cause probable : src/modules/parquet/state/module.ts (lignes d’achat par variante quel que soit board.handed).
- Recommandation : Une seule ligne quand la lame n’a pas de variantes ; alerte bloquante ou proposition d’une lame A/B.

### PAR-02 — Calepinage parquet, étape Pose

**métier** · tous (29)

Le mur de référence (parallèle aux lames à 0°) ne se choisit nulle part : le modèle prévoit `layout.reference` mais aucun écran ne le règle. Seul l’angle permet de tourner la pose.

- Preuve : docs/audit/captures-local/mesures/F2/*.json (axe-ou-reference: [])
- Reproduire : Calepinage parquet → Pose : pas de choix du mur.
- Cause probable : src/modules/parquet/state/model.ts:44 (reference toujours null, src/modules/parquet/state/module.ts:167).
- Recommandation : Choix du mur de référence sur le dessin (toucher un mur) ou en liste dans l’étape Pose.

### PAR-03 — Parquet : éditeur, vue globale, résultats

**texte** · tous (29)

La « perte » n’a pas la même valeur selon l’écran : « perte 10 % » dans le résumé de l’éditeur et la vue globale, « Perte de la pose 4,6 % » dans les résultats ; « 52 lames » (à acheter) côtoie « Lames posées 64 » (morceaux). Même ambiguïté au carrelage : « Carreaux posés 22, Nécessaires 20, À commander 22 ».

- Preuve : docs/audit/captures-local/mesures/F6/pc-1280x800-chromium.json ; docs/audit/captures-local/mesures/E7/pc-1280x800-chromium.json
- Reproduire : Projet maison → parquet du séjour : comparer éditeur et résultats.
- Cause probable : Résumé du module (marge d’achat) et rapport (perte de coupe) nommés pareil.
- Recommandation : Deux termes distincts : « chutes de coupe 4,6 % » et « marge d’achat 10 % » ; « morceaux posés » au lieu de « lames posées ».

### CAR-02 — Calepinage carrelage, étape Produit

**UX** · téléphones surtout

Les 28 carreaux de la bibliothèque sont une seule liste de boutons radio, sans recherche ni filtre (sol/mur, format) : 2 150 px de haut sur téléphone. Les bibliothèques (28 à 33 produits) n’ont pas non plus de recherche.

- Preuve : docs/audit/captures/calepinage-carrelage/tel-390x844-portrait-chromium/E1-produit.jpg ; docs/audit/captures-local/mesures/E1/*.json ; docs/audit/captures-local/mesures/J5/*.json
- Reproduire : Calepinage carrelage → Produit.
- Cause probable : src/modules/carrelage/ui/editor/TileTab.svelte:47-62 ; listes des bibliothèques.
- Recommandation : Champ de recherche, carreaux récents et du projet en tête, filtre par usage et format.

### CAR-03 — Pièce → Revêtir : carrelage (sol)

**métier** · tous (29)

Un sol revêtu de carrelage reçoit par défaut « Carreau métro 20 × 10 cm » (faïence murale, 7 mm) : produit de mur posé au sol sans alerte.

- Preuve : docs/audit/captures/calepinage-carrelage/tel-390x844-portrait-chromium/N1-light.jpg ; docs/audit/captures-local/mesures/E1/*.json (carreau-choisi)
- Reproduire : Nouveau projet → Pièce → Sol → Revêtir : carrelage → Calepinage.
- Cause probable : Carreau par défaut de createPose (premier modèle type), indépendant de la surface.
- Recommandation : Carreau par défaut selon la surface (grès 60 × 60 au sol, faïence au mur) et alerte « carreau de mur posé au sol ».

### ACH-02 — Achats, saisie des prix

**robustesse** · tous (29)

Une saisie invalide efface le prix existant : « abc » efface le prix (toast « effacé »), « -3 » aussi alors que le champ affiche encore « -3 » ; « 0 » efface (impossible de noter un article gratuit ou déjà en stock). Les toasts s’empilent à chaque saisie.

- Preuve : docs/audit/captures-local/mesures/J2/pc-1280x800-chromium.json
- Reproduire : Achats → prix du stratifié : 12,5 puis abc.
- Cause probable : src/ui/screens/Shopping.svelte:33-46
- Recommandation : Refuser la saisie invalide en gardant l’ancien prix, avec un message sous le champ ; accepter 0 € ; un seul toast remplacé.

### A11Y-01 — Tous les écrans

**a11y** · tous (29)

Le titre du document reste « PilePoil » sur tous les écrans (WCAG 2.4.2) : onglets, historique et lecteurs d’écran n’annoncent pas l’écran ; les éditeurs de calepinage (carrelage, parquet, peinture) n’ont pas de titre h1.

- Preuve : docs/audit/captures-local/mesures/N1/*.json (title, h1)
- Reproduire : Naviguer entre les écrans en regardant l’onglet.
- Cause probable : Aucun document.title par route (src/ui/lib/router.svelte.ts) ; en-tête de src/ui/calepinage/PoseEditorShell.svelte:116-126 sans h1.
- Recommandation : Titre « <écran> — <projet> · PilePoil » à chaque route ; h1 (visuellement discret) dans les éditeurs.

### A11Y-02 — Fiche carreau, Achats (texte agrandi à 200 %)

**a11y** · téléphones et ordinateur

Avec le texte à 200 %, la fiche carreau déborde de 73 px en largeur sur téléphone (boutons de formats courants) et les achats de 16 px sur ordinateur : défilement horizontal (WCAG 1.4.4 / 1.4.10).

- Preuve : docs/audit/captures/fiche-carreau/tel-390x844-portrait-chromium/N3-texte200.jpg ; docs/audit/captures-local/mesures/N3/*.json
- Reproduire : Agrandir le texte du navigateur à 200 % → #/library/tiles/modele-gres-60x60.
- Cause probable : Rangée de boutons « Formats courants » sans retour à la ligne (TileForm.svelte) ; colonne prix des achats à largeur fixe.
- Recommandation : flex-wrap sur les rangées de boutons ; colonnes des achats en grille qui passe sous le libellé.

### PERF-01 — Mes projets, Vue globale, Résultats (téléphone)

**perf** · téléphones Chromium (Lighthouse mobile)

Lighthouse mobile sous l’objectif de 90 (docs/PLAN.md P5) avec un projet : accueil 75 (TBT 1,4 s), vue globale 72 (TBT 2,35 s), résultats 80 (CLS 0,38). Sur ordinateur, résultats 94 avec CLS 0,15.

- Preuve : docs/audit/mesures/performance.md (M3)
- Reproduire : Lighthouse mobile sur #/ et #/p/:id avec le projet maison.
- Cause probable : Vignettes et résumés calculés au chargement (Home → ProjectCard, Project.svelte:33-48) ; onglets des résultats qui se remplissent après coup (Results.svelte).
- Recommandation : Différer les vignettes (requestIdleCallback, mise en cache par empreinte du projet) ; réserver la hauteur des résultats.

### AIDE-01 — Toute l’application

**UX** · tous (29)

Il n’y a ni aide, ni prise en main, ni glossaire : « pose », « zone », « bande », « calepinage », « coupe fine », « coupe perdue », « État des lieux / Travaux » ne sont expliqués nulle part ; « À propos » ne parle que du carrelage.

- Preuve : docs/audit/captures-local/mesures/K2/*.json (aide: 0 lien)
- Reproduire : Réglages → À propos.
- Cause probable : src/ui/screens/Settings.svelte:137-144
- Recommandation : Prise en main en 3 écrans au premier lancement, aide contextuelle (i) sur les termes métier, page « Comment ça marche ».

### UI-04 — Fiche carreau et réglages (WebKit, texte agrandi)

**UI** · iPhone 360 px (WebKit) ; texte à 200 % sur tous les téléphones

Sous WebKit à 360 px, la fiche carreau déborde de 6 px à droite (la page défile latéralement, le bord droit des champs touche l’écran). Avec le texte à 200 %, le débordement atteint 73 px sous Chromium et 262 à 332 px sous WebKit (fiche carreau), 76 à 146 px dans les Réglages sous WebKit : formats courants et rangées de boutons sans retour à la ligne.

- Preuve : docs/audit/captures/fiche-carreau/tel-360x740-portrait-webkit/N1-light.jpg ; docs/audit/captures/fiche-carreau/tel-390x844-portrait-webkit/N3-texte200.jpg ; docs/audit/mesures/controles.md
- Reproduire : iPhone SE (ou 360 px WebKit) → #/library/tiles/modele-gres-60x60 ; puis texte à 200 %.
- Cause probable : Rangées sans retour à la ligne dans src/modules/carrelage/ui/components/TileForm.svelte (formats courants, forme) et Segmented de largeur fixe ; contenu plus large que la colonne sous WebKit.
- Recommandation : Segmented et rangées de pastilles à retour à la ligne, min-width:0 sur les conteneurs de formulaire ; test « pas de défilement horizontal » à 360 px et à 200 % dans la suite e2e.

## P3 (20)

### PLAN-06 — Plan, messages d’erreur

**texte** · tous (29)

Trois points alignés (aire nulle) donnent « Les murs se croisent » ; la forme en U trop étroite dit « Le retrait doit rester plus petit que la pièce » (le U a des « ailes » et une « encoche ») ; renommer un projet avec un nom vide ne fait rien, sans message.

- Preuve : docs/audit/captures/plan/tel-390x844-portrait-chromium/C4-aire-nulle.jpg ; docs/audit/captures/nouveau-projet/tel-390x844-portrait-chromium/B2-forme-U-erreur.jpg
- Reproduire : Dessin : 3 points alignés → Terminer ; Nouveau projet → En U → ailes 600.
- Cause probable : src/ui/plan/planState.svelte.ts:495 ; src/ui/plan/AddRoomDialog.svelte:95 ; src/ui/plan/PlanEditor.svelte:39-45
- Recommandation : Messages propres à chaque cas (« Les points sont alignés : la pièce n’a pas de surface », « Les ailes doivent laisser une encoche »).

### PLAN-07 — Plan et calepinage : annuler après rechargement

**robustesse** · tous (29)

L’historique d’annulation est perdu au rechargement (Annuler grisé), et la dernière modification est perdue si la page se recharge moins de 0,3 s après (tirer pour actualiser).

- Preuve : docs/audit/captures-local/mesures/C11/*.json ; docs/audit/captures-local/mesures/L2/*.json
- Reproduire : Plan → modifier une cote → recharger : Annuler est grisé.
- Cause probable : Historique en mémoire (src/state/history.ts) ; enregistrement différé de 300 ms (src/storage/autosave.ts:8) et flush asynchrone au pagehide.
- Recommandation : Garder les 20 derniers états dans IndexedDB par projet ; enregistrer aussi au visibilitychange.

### PLAN-08 — Plan

**UX** · ordinateur

Le plan n’a pas les raccourcis du calepinage : ni Ctrl+Z / Ctrl+Y, ni + / − / 0 pour zoomer (le calepinage carrelage les a).

- Preuve : docs/audit/captures-local/mesures/C9/pc-1280x800-chromium.json (clavier-plus sans effet) ; docs/audit/captures-local/mesures/C11/*.json (ctrl-z n/a)
- Reproduire : Plan → cliquer le dessin → Ctrl+Z, +.
- Cause probable : src/ui/plan/PlanCanvas.svelte:283-300 (seulement Échap et Suppr)
- Recommandation : Mêmes raccourcis partout (coquille).

### PLAN-09 — Plan, travaux

**texte** · tous (29)

Une cloison qui coupe une pièce crée « Séjour (2) » sans proposer de nom ; ce nom se retrouve dans les résultats, le PDF et les achats.

- Preuve : docs/audit/captures/projet/pc-1280x800-chromium/N1-light.jpg
- Reproduire : Plan → Travaux → Tracer une cloison au milieu du séjour.
- Cause probable : core/plan/derive.ts (nommage des pièces dérivées)
- Recommandation : Demander le nom de la nouvelle pièce à la fin du tracé, comme pour un dessin.

### PLAN-10 — Plan, étiquettes

**UI** · téléphones

Le nom d’une petite pièce déborde de son contour et recouvre le mur (« Salle de bain »).

- Preuve : docs/audit/captures/plan/tel-390x844-portrait-chromium/N1-light.jpg
- Reproduire : Plan du projet maison sur téléphone.
- Cause probable : src/ui/plan/PlanCanvas.svelte (étiquettes de pièce à taille fixe)
- Recommandation : Réduire ou abréger l’étiquette quand elle ne tient pas.

### NOU-01 — Nouveau projet #/new

**UX** · tous (29)

« Annuler » dans « Nouveau projet » laisse un éditeur de plan vide sur #/new (« Mon projet, Plan des pièces ») au lieu de revenir à l’accueil.

- Preuve : docs/audit/captures/nouveau-projet/tel-390x844-portrait-chromium/B1-annule.jpg
- Reproduire : Accueil → Nouveau projet → Annuler.
- Cause probable : src/ui/plan/AddRoomDialog.svelte:102 (ferme seulement la fenêtre)
- Recommandation : Annuler un projet neuf ramène à l’accueil.

### PIE-02 — Pièce, revêtir

**UX** · tous (29)

Le parquet n’est pas proposé sur un mur : le bouton est absent au lieu d’être grisé avec la raison (docs/NAVIGATION.md §4) ; après « Revêtir », il faut encore toucher « Calepinage » pour régler la pose.

- Preuve : docs/audit/captures-local/mesures/D2/*.json
- Reproduire : Pièce → Mur 1.
- Cause probable : src/ui/room/cover.ts (modulesFor filtre) ; src/ui/screens/Room.svelte:352-356
- Recommandation : Bouton grisé avec « Le parquet se pose au sol » ; ouvrir le calepinage après une première pose.

### PIE-03 — Pièce, zone de mur

**texte** · tous (29)

Hauteurs incohérentes : le message « Le haut de la zone doit être au-dessus du bas » s’affiche deux fois dans le même toast et reste après une saisie correcte ; « Jusqu’à 400 cm » devient 250 cm sans message.

- Preuve : docs/audit/captures-local/mesures/D5/*.json
- Reproduire : Pièce → Mur 1 → Depuis le sol 150, Jusqu’à 90.
- Cause probable : src/ui/screens/Room.svelte:143-150
- Recommandation : Message sous le champ, effacé dès que la saisie est correcte ; dire quand la hauteur est bornée à celle de la pièce.

### CAR-04 — Calepinage carrelage, liste des carreaux

**texte** · tous (29)

Formats incohérents : « 1194 × 596 mm » à côté de « 90 × 30 cm », et l’ordre des côtés change entre le nom (« 59,6 × 119,4 ») et la taille (« 1194 × 596 mm »).

- Preuve : docs/audit/captures/calepinage-carrelage/pc-1280x800-chromium/N1-light.jpg
- Reproduire : Calepinage carrelage → Produit.
- Cause probable : tileSize() dans src/modules/carrelage/ui/editor/TileTab.svelte:57
- Recommandation : Toujours en cm, largeur × longueur dans le même ordre que le nom.

### CAR-05 — Calepinage carrelage

**UX** · tous (29)

Optimiser : pas de barre de progression accessible (le texte du bouton change seulement) et aucun message quand le départ est déjà le meilleur ; le bouton flottant « Optimiser » masque le coin du dessin.

- Preuve : docs/audit/captures/calepinage-carrelage/tel-390x844-portrait-chromium/E3-optimisation.jpg ; docs/audit/captures-local/mesures/E3/*.json
- Reproduire : Calepinage → Optimiser.
- Cause probable : src/modules/carrelage/ui/editor/Editor.svelte
- Recommandation : role=progressbar, message « Départ déjà optimal » ou « 3 coupes fines en moins » ; bouton hors du dessin.

### CAR-06 — Calepinage carrelage, réservations et bandes

**robustesse** · tous (29)

Une réservation de 5 m sur un mur de 4,7 m est acceptée ; « -20 » cm devient 0 sans message ; marge de casse 100 % devient 50 % sans message.

- Preuve : docs/audit/captures-local/mesures/E4/*.json ; docs/audit/captures-local/mesures/E5/*.json
- Reproduire : Calepinage murs salle de bain → Découpage → Ajouter → Largeur 5000.
- Cause probable : NumberField (bornes silencieuses), OpeningsTab.svelte
- Recommandation : Bornes visibles et message quand la valeur est corrigée.

### TXT-01 — Résultats, PDF

**texte** · tous (29)

Le bouton des résultats d’une pose de peinture s’appelle « PDF du calepinage » ; titres « Carrelage · Pose 5 » et fil « Carrelage – Pose 5 » (deux séparateurs) ; « 0 projet, enregistrés » dans les réglages.

- Preuve : docs/audit/captures-local/mesures/G3/*.json ; docs/audit/captures/resultats-pose/tel-390x844-portrait-chromium/N1-dark.jpg ; docs/audit/captures-local/mesures/K1/*.json
- Reproduire : Résultats d’une pose de peinture ; Réglages sans projet.
- Cause probable : src/ui/screens/Results.svelte ; src/ui/screens/Settings.svelte:85
- Recommandation : « PDF de la pose » ; un seul séparateur ; accord du pluriel.

### ROB-03 — Achats, export

**robustesse** · tous (29)

Trois clics rapides sur « Exporter en PDF » produisent trois fichiers (le bouton n’est pas désactivé pendant la création), contrairement aux résultats.

- Preuve : docs/audit/captures-local/mesures/L8/*.json (pdf-triple 3)
- Reproduire : Achats → triple clic sur Exporter en PDF.
- Cause probable : src/ui/screens/Shopping.svelte (exportPdf sans état « en cours »)
- Recommandation : Même état busy que Results.svelte.

### ROB-04 — Stockage indisponible

**texte** · tous (29)

L’écran « Impossible d’ouvrir vos données » s’affiche avec le toast « PilePoil fonctionne maintenant sans connexion » : deux messages contradictoires.

- Preuve : docs/audit/captures/accueil/tel-390x844-portrait-chromium/L9-stockage-indisponible.jpg
- Reproduire : Navigation privée sans IndexedDB.
- Cause probable : src/ui/lib/pwa.svelte.ts:60 (toast indépendant de app.fatal)
- Recommandation : Ne pas afficher le toast hors ligne quand l’application n’a pas pu démarrer.

### BIB-01 — Bibliothèques, produit utilisé

**UX** · tous (29)

Supprimer un produit utilisé est refusé avec une explication claire, mais seulement « Compris » : pas de lien vers le projet ni d’action « Remplacer par… ».

- Preuve : docs/audit/captures/fiche-tiles/tel-390x844-portrait-chromium/J6-utilise.jpg ; docs/audit/captures-local/mesures/J6/*.json
- Reproduire : Bibliothèque → carreau métro → Supprimer le carreau.
- Cause probable : src/ui/components/ItemInUseDialog.svelte
- Recommandation : Lien « Ouvrir le projet » et remplacement par un autre produit.

### PERF-02 — Chargement

**perf** · tous (29)

2,6 Mo de fichiers précachés (195 fichiers) ; jsPDF 390 Ko et html2canvas 195 Ko (dépendance de jsPDF, sans doute inutile ici) ; scène 3D 372 Ko.

- Preuve : docs/audit/captures-local/mesures/M4/pc-1280x800-chromium.json
- Reproduire : npm run build.
- Cause probable : vite.config.ts (precache), import de jspdf
- Recommandation : Exclure html2canvas et purify (jsPDF sans .html()) ; précharger la 3D et le PDF seulement après le premier écran.

### UI-05 — Plan et calepinage sur tablette 768 px

**UI** · tablettes 768 × 1024 (portrait et paysage)

Sous 1024 px de large, les tablettes reçoivent la mise en page téléphone : plan limité à la moitié haute, panneau tiré qui occupe le reste (boutons étirés sur plus de 700 px). Un iPad de 768 px a pourtant la place d’un panneau latéral.

- Preuve : docs/audit/captures/plan/tab-768x1024-portrait-webkit/N1-light.jpg
- Reproduire : Plan du projet maison sur un écran de 768 × 1024.
- Cause probable : Seuil unique min-width:1024px (src/ui/plan/PlanEditor.svelte:79, src/ui/calepinage/PoseEditorShell.svelte:83).
- Recommandation : Panneau latéral dès 700 px de large (paysage compris), panneau tiré seulement en dessous.

### UX-05 — Résultats, onglet Détail (téléphone)

**UX** · téléphones

L’onglet Détail des résultats du projet fait environ 11 300 px de haut sur téléphone (14 écrans de défilement) : fiche de coupe de chaque rang et de chaque plaque à la suite, sans sommaire ni repli par pose.

- Preuve : docs/audit/mesures/echecs.md (I1 : capture pleine page impossible au-delà de 32 767 px sous WebKit) ; hauteur mesurée 11 341 px sur 390 × 844
- Reproduire : Résultats du projet maison → Détail.
- Cause probable : src/ui/screens/Results.svelte (onglet Détail sans repli), sections des modules.
- Recommandation : Sections repliables par pose, lien « aller à… » en tête, fiche de coupe ouverte seulement pour la pose consultée.

### A11Y-03 — Pièce (murs dépliés), Résultats, Plan (panneau plein)

**a11y** · téléphones et ordinateur (25 appareils pour le lien de cloison)

Cibles sous 44 px : murs étroits de l’écran Pièce (26 × 66 et 66 × 21 px, 16 appareils) ; lien « Cloison 1 » des résultats (21 px de haut) ; « Voir tout le plan » trop près d’une autre cible quand le panneau est ouvert en paysage (axe target-size) ; bouton « Optimiser » à 200 %.

- Preuve : docs/audit/captures/plan/tel-375x667-paysage-chromium/C10-panneau-plein.jpg ; docs/audit/mesures/controles.md
- Reproduire : Écran Pièce d’un L ; résultats du projet ; plan en paysage, panneau plein.
- Cause probable : src/ui/room/RoomDrawing.svelte (zone de toucher = le mur déplié) ; src/ui/screens/Results.svelte (lien en ligne) ; src/ui/plan/PlanEditor.svelte (bouton flottant).
- Recommandation : Zone de toucher élargie autour des murs fins (la liste de surfaces existe comme alternative) ; lien de cloison en bouton de 44 px ; écarter le bouton flottant.

### DOC-01 — Documents

**texte** · —

Écarts documents ↔ code : docs/UX.md décrit l’ancienne application (assistant 4 étapes, onglets Commande / Découpe / Achats / Encollage, écran Surface) ; docs/BOITE.md parle du calque « Existant », l’écran dit « État des lieux » ; NAVIGATION.md §4 veut le parquet grisé sur un mur, il est absent ; NAVIGATION.md §6 promet la même coquille, parquet et carrelage ont des outils de vue différents.

- Preuve : docs/audit/CARTOGRAPHIE.md §3
- Reproduire : —
- Cause probable : —
- Recommandation : Mettre docs/UX.md à jour depuis NAVIGATION.md (sans trancher ici).

