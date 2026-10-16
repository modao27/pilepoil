/**
 * Constats de l'audit UI/UX (source unique) : `npx tsx tests/audit/constats.ts` écrit docs/audit/constats.csv et
 * docs/audit/CONSTATS.md. Gravité : P0 bloque une tâche, perd des données ou donne un calcul faux ; P1 gêne forte,
 * contournement difficile, échec a11y bloquant ; P2 gêne réelle avec contournement ; P3 finition, cohérence, confort.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Gravity = 'P0' | 'P1' | 'P2' | 'P3';
type Axis = 'UX' | 'UI' | 'a11y' | 'perf' | 'texte' | 'métier' | 'robustesse';

export interface Finding {
  id: string;
  screen: string;
  devices: string;
  gravity: Gravity;
  axis: Axis;
  finding: string;
  proof: string;
  steps: string;
  cause: string;
  reco: string;
}

const C = 'docs/audit/captures';
const TEL = 'tel-390x844-portrait-chromium';
const PC = 'pc-1280x800-chromium';
const ALL = 'tous (29)';
const M = 'docs/audit/captures-local/mesures';

export const FINDINGS: Finding[] = [
  /* ---------- P1 ---------- */
  {
    id: 'PRJ-01',
    screen: 'Mes projets #/',
    devices: ALL,
    gravity: 'P1',
    axis: 'UX',
    finding:
      'Un projet sans carrelage (parquet, peinture ou cloisons seuls, ou sans revêtement) n’a aucun menu sur l’accueil : impossible de le renommer depuis l’accueil, de le dupliquer ou de le supprimer, et aucun autre écran ne supprime un projet.',
    proof: `${C}/accueil/${TEL}/B6-sans-carrelage.jpg ; ${M}/B6/*.json (menu: 0)`,
    steps: 'Nouveau projet → pièce → Revêtir : parquet → revenir à l’accueil : la carte n’a pas de bouton ⋯.',
    cause:
      'src/ui/screens/Home.svelte:12 (carte = premier outil qui fournit screens.card, seul le carrelage en fournit une) ; menu dans src/modules/carrelage/ui/components/ProjectCard.svelte:68-107',
    reco: 'Carte de projet commune dans la coquille (nom, date, m² par outil, coût) avec le menu Renommer / Dupliquer / Supprimer pour tous les projets ; la vignette du module devient un enrichissement facultatif.',
  },
  {
    id: 'PLAN-01',
    screen: 'Plan #/p/:id/plan',
    devices: 'tous (souris et toucher)',
    gravity: 'P1',
    axis: 'UX',
    finding:
      'Glisser un coin de pièce le déplace bien plus loin que le doigt (×2 à ×3) : 33 × 21 px de geste font passer une pièce de 12 m² à 25 m² (murs de 767 et 913 cm au lieu d’environ 400) sur téléphone, 15 m² sur ordinateur. La pièce perd ses angles droits sans que l’utilisateur l’ait voulu.',
    proof: `${C}/plan/${TEL}/C8-coin-deplace.jpg ; ${M}/C8/*.json`,
    steps: 'Nouveau projet 400 × 300 → toucher la pièce → glisser un coin de quelques millimètres.',
    cause:
      'src/ui/plan/PlanCanvas.svelte:32-38 : tant que la vue n’a pas été bougée (userView null), le cadrage est recalculé depuis les limites du plan à chaque modification, donc pendant le glissement (l.143-151) : la conversion écran → plan change sous le doigt.',
    reco: 'Figer la vue au début d’un glissement (userView = view au pointerdown) et ne recadrer qu’au relâcher, ou sur « Voir tout ».',
  },
  {
    id: 'PLAN-02',
    screen: 'Plan #/p/:id/plan',
    devices: 'ordinateur et tablette avec clavier',
    gravity: 'P1',
    axis: 'robustesse',
    finding:
      'La touche Suppr (ou Retour arrière) supprime la pièce sélectionnée et ses poses sans la confirmation que demande le bouton « Supprimer la pièce » (« « Salle de bain » a des revêtements qui seront perdus… »). L’annulation n’existe que tant que l’historique est en mémoire (perdu au rechargement, PLAN-07).',
    proof: `${C}/plan/${PC}/C12-apres-suppr.jpg ; ${C}/plan/${PC}/C12-confirmer-suppression.jpg ; ${M}/C12/${PC}.json`,
    steps:
      'Plan du projet maison → toucher « Salle de bain » dans la liste → cliquer le dessin → Suppr : la pièce et les poses 5 et 6 disparaissent sans question.',
    cause:
      'src/ui/plan/PlanCanvas.svelte:289-291 appelle st.removeRoom directement ; le bouton passe par askRemove (src/ui/plan/PlanPanel.svelte:540).',
    reco: 'Faire passer le raccourci par la même confirmation que le bouton quand la pièce porte des revêtements.',
  },
  {
    id: 'ACH-01',
    screen: 'Achats #/p/:id/achats et PDF des achats',
    devices: ALL,
    gravity: 'P1',
    axis: 'métier',
    finding:
      'Les lignes « Rail R48 — barre de 3 m » et « Montant M48 — barre de 2,5 m » n’affichent aucune quantité (« Cloisons · » puis rien), ni à l’écran ni dans le PDF : on ne sait pas combien en acheter. Le CSV, lui, donne 3 rails et 10 montants (justes : 2 × 400 cm de rail en barres de 3 m ; 2 + 6 + 2 montants à 60 cm d’entraxe).',
    proof: `${C}/achats/${TEL}/N1-light.jpg ; ${M}/J1/*.json (quantites-vides) ; ${M}/J3, J4`,
    steps: 'Projet maison → Achats : groupe « Ossature et plaques ».',
    cause:
      'src/modules/cloisons/state/module.ts:51-67 (lignes sans `detail`) et src/ui/screens/Shopping.svelte:100, src/ui/lib/shoppingPdf.ts:21 (seul `detail` est affiché, jamais `quantity` avec son unité).',
    reco: 'Afficher toujours la quantité et l’unité d’achat (« 3 barres ») dans l’écran et le PDF, le détail en complément ; donner un détail aux rails et montants (« 8 m, barres de 3 m »).',
  },
  {
    id: 'CAR-01',
    screen: 'Calepinage carrelage, motif Vannerie ; Achats',
    devices: ALL,
    gravity: 'P1',
    axis: 'métier',
    finding:
      'En vannerie, la liste d’achat sépare le carreau en deux produits : « 20 × 10 cm » (33 cartons) et « 20 × 9,9 cm » (15 cartons), ce dernier n’existe pas en magasin et n’a pas de prix. Le total estimé tombe de 585 € à 411 € alors que le nombre de carreaux augmente.',
    proof: `${C}/achats/${PC}/E2-vannerie.jpg ; ${M}/E2/${PC}.json (vannerie)`,
    steps: 'Projet maison → calepinage du sol de la salle de bain → Pose → Vannerie → Achats.',
    cause:
      'Règle voulue (docs/carrelage/DOMAIN.md:20 : largeur ramenée à S/n − j) mais les achats regroupent par taille posée (src/modules/carrelage/core/shopping/items.ts:48, clé tile|<taille>) au lieu du produit de la bibliothèque. Moteur sous parité legacy.',
    reco: 'Regrouper les lignes par carreau de la bibliothèque dans l’adaptateur d’achats (src/modules/carrelage/state/module.ts:117-141), sans toucher au moteur : la parité (tests/parity/parity.test.ts:216) compare les clés du moteur. La largeur ramenée reste une recoupe, à signaler dans la fiche de coupe.',
  },
  {
    id: 'ROB-01',
    screen: 'Deux onglets sur le même projet',
    devices: 'ordinateur (surtout)',
    gravity: 'P1',
    axis: 'robustesse',
    finding:
      'Avec le plan ouvert dans un onglet et les achats dans un autre, le nom de pièce changé dans le premier est écrasé sans message par l’enregistrement du second (dernier qui écrit gagne). Le second onglet ne voit pas la modification du premier.',
    proof: `${M}/L7/${TEL}.json (final.pieces = Séjour, onglet-B-voit-A = false)`,
    steps:
      'Onglet A : plan, renommer « Séjour » ; onglet B (ouvert avant) : Achats, saisir un prix ; recharger : le nom est revenu à « Séjour ».',
    cause:
      'src/ui/lib/app.svelte.ts:88-92 : l’état des projets est chargé une fois par onglet, aucune synchronisation entre onglets (BroadcastChannel, storage event) ni contrôle de version à l’écriture.',
    reco: 'Diffuser chaque enregistrement aux autres onglets (BroadcastChannel) et refuser une écriture dont la base a changé (updatedAt) en proposant de recharger.',
  },
  /* ---------- P2 ---------- */
  {
    id: 'PLAN-03',
    screen: 'Plan, dessin libre (#/new, Ajouter une pièce → Dessin)',
    devices: 'téléphones et tablettes (toucher), Chromium et WebKit',
    gravity: 'P2',
    axis: 'UX',
    finding:
      'Au toucher, toucher le premier point pour fermer la pièce (consigne affichée) ne fait rien : la fenêtre « Nommer la pièce » s’ouvre et se referme aussitôt. À la souris, elle reste ouverte. Contournement : « Terminer la pièce ».',
    proof: `${C}/echecs/${TEL}/B2-echec-dessin-creer.jpg ; ${M}/B2/*.json (dessin:fenetre-nom false au toucher, true à la souris)`,
    steps: 'Nouveau projet → Dessin → toucher 4 coins puis le premier.',
    cause:
      'Probable « clic fantôme » : la fenêtre s’ouvre au pointerup (src/ui/plan/PlanCanvas.svelte:213-226 → planState.svelte.ts:471-476), le clic synthétique qui suit le toucher tombe sur son fond et la ferme (Dialog onclose, src/ui/plan/PlanEditor.svelte:188). À confirmer sur un vrai téléphone.',
    reco: 'Ouvrir la fenêtre au clic (ou après le cycle d’événements), ou ignorer un clic sur le fond dans les 300 ms qui suivent l’ouverture.',
  },
  {
    id: 'PLAN-04',
    screen: 'Plan, saisie des cotes (tous les NumberField)',
    devices: ALL,
    gravity: 'P2',
    axis: 'UX',
    finding:
      'Les cotes sont en centimètres sans le dire dans la saisie : « 2,4 » devient un mur de 2,4 cm, accepté sans alerte ; « 2,4 m » ou « 240 cm » sont refusés en silence (la valeur précédente revient, seul aria-invalid change) ; « 0 », « -50 » deviennent 1 cm sans message ; 100 m de mur ou 1 km de hauteur sous plafond sont acceptés.',
    proof: `${C}/plan/${TEL}/C2-saisie-abc.jpg ; ${M}/C2, C14, L1`,
    steps: 'Plan → pièce → Mur 1 : taper 2,4 m puis Entrée ; taper 2,4 ; taper 0.',
    cause:
      'src/ui/lib/calc.ts:5 (pas d’unité dans les expressions) ; src/ui/components/NumberField.svelte:57 (valeur invalide ignorée, bornes appliquées sans message).',
    reco: 'Accepter les unités (« 2,4 m », « 240 cm », « 2400 mm ») ; message sous le champ quand la saisie est refusée ou bornée ; alerte de vraisemblance (mur < 20 cm ou > 30 m, hauteur > 6 m).',
  },
  {
    id: 'PLAN-05',
    screen: 'Plan, obstacle',
    devices: ALL,
    gravity: 'P2',
    axis: 'a11y',
    finding:
      'Un obstacle n’a ni position ni distance au mur dans le panneau (seulement Type, Largeur, Profondeur) : il ne se place qu’en le glissant. Impossible au clavier et imprécis au doigt ; docs/UX.md promet « le panneau permet tout sans pointeur ».',
    proof: `${C}/plan/${TEL}/C5-obstacle.jpg ; ${M}/C5/*.json (position-reglable: 0)`,
    steps: 'Plan → pièce → Ajouter un obstacle.',
    cause: 'src/ui/plan/PlanPanel.svelte:385-416',
    reco: 'Ajouter « Distance au mur gauche / au mur du haut » (cotes) à l’obstacle, comme pour les ouvertures.',
  },
  {
    id: 'PIE-01',
    screen: 'Pièce, découpe du sol',
    devices: 'téléphones surtout',
    gravity: 'P2',
    axis: 'UX',
    finding:
      'Pendant « Découper par une ligne », toucher juste au bord du sol tombe sur un mur déplié : la découpe est abandonnée sans message et le mur est sélectionné, alors que la consigne dit « d’un mur à l’autre ». Dans l’angle rentrant d’un L, les murs 3 et 4 dépliés se chevauchent.',
    proof: `${C}/piece/${TEL}/D4-decoupe-ligne-faite.jpg`,
    steps:
      'Pièce salle de bain (L) → Sol → Découper par une ligne → toucher le haut du sol puis le bas, au ras du bord.',
    cause:
      'src/ui/screens/Room.svelte:71-74 (select() remet cutting à null) ; dessin des murs dépliés dans src/ui/room/RoomDrawing.svelte:120-140.',
    reco: 'En mode découpe, ignorer la sélection d’un mur et aimanter le point au bord du sol ; décaler les murs dépliés qui se chevauchent.',
  },
  {
    id: 'ROB-02',
    screen: 'Tous les écrans de calcul',
    devices: ALL,
    gravity: 'P2',
    axis: 'robustesse',
    finding:
      'Si le moteur de calcul ne se charge pas (fichier du worker en erreur, cache abîmé), tout reste sur « Calcul… » indéfiniment : vue globale, calepinage, achats. Pas de message ni de « Réessayer », alors que ComputeFailed existe pour un calcul en erreur.',
    proof: `${C}/projet/${TEL}/L12-calcul-echec.jpg ; ${C}/calepinage-carrelage/${TEL}/L12-calcul-echec.jpg`,
    steps: 'Bloquer le fichier compute.worker (outils de développement) puis ouvrir un projet.',
    cause: 'src/workers/client.ts : pas de gestion de l’événement error du Worker ni de délai de réponse.',
    reco: 'Écouter worker.onerror et un délai maximal ; afficher ComputeFailed avec « Recharger l’application ».',
  },
  {
    id: 'UI-01',
    screen: 'Tous les formulaires (TextField, Select, prix des achats)',
    devices: 'iPhone et iPad (Safari)',
    gravity: 'P2',
    axis: 'UI',
    finding:
      'Les champs texte, les listes et les prix des achats sont en 14 px : Safari iOS zoome à chaque saisie (nom du projet, nom de pièce, système de cloison, peinture, 18 prix des achats). docs/UX.md et docs/IDENTITE.md imposent 16 px minimum ; seuls les champs numériques (NumberField) y sont.',
    proof:
      'docs/audit/mesures/controles.md (colonne champs < 16 px) ; à vérifier sur iPhone (A_TESTER_SUR_TELEPHONE.md)',
    steps: 'Sur iPhone : Nouveau projet → toucher « Nom du projet ».',
    cause:
      'src/ui/design/typo.css:8 met 14 px sur html, et --text-input vaut 1rem (src/ui/design/tokens.css:66, commentaire « 16 px mini ») : 1rem = 14 px. Appliqué par src/ui/design/base.css:49-52.',
    reco: 'Exprimer --text-input en px (16 px) ou en rem calculé sur 16 px ; garder le test de contraste et ajouter un test « champs ≥ 16 px ».',
  },
  {
    id: 'UI-02',
    screen: 'Calepinage parquet (téléphone)',
    devices: 'téléphones portrait',
    gravity: 'P2',
    axis: 'UI',
    finding:
      'La liste « Lame » de l’étape Produit dépasse à droite de l’écran (468 px dans 390 px) ; le bord et la flèche sont coupés. Le plan des lames n’a ni cotes ni boutons de zoom ni vues Plan / Rendu / 3D, contrairement au carrelage, alors que NAVIGATION.md promet la même coquille.',
    proof: `${C}/calepinage-parquet/${TEL}/N1-light.jpg`,
    steps: 'Projet maison → Séjour → Sol → Calepinage (téléphone).',
    cause:
      'src/modules/parquet/ui/components/ParquetEditor.svelte:222 (Select sans largeur maximale) ; outils de vue absents de ParquetPlan.svelte.',
    reco: 'Select à 100 % de largeur ; reprendre les outils de vue (cotes, zoom, ajuster) de la coquille commune.',
  },
  {
    id: 'UI-03',
    screen: 'Calepinage et plan en paysage (téléphone)',
    devices:
      'téléphones en paysage (7 appareils sur 8) ; « Voir tout le plan » trop petit en paysage 375 × 667 et 360 × 740 (axe target-size)',
    gravity: 'P2',
    axis: 'UI',
    finding:
      'En paysage, le panneau tiré garde la mise en page portrait : à mi-hauteur il laisse environ 150 px au dessin, les outils flottants (Plan / Rendu / 3D, zoom) recouvrent la cote « 300 cm » et le coin du dessin, la consigne du panneau passe sous le résumé, à moitié coupée ; les réglages de l’étape ne sont pas visibles sans agrandir le panneau, qui cache alors tout le dessin.',
    proof: `${C}/calepinage-carrelage/tel-360x740-paysage-chromium/E1-produit.jpg ; ${C}/calepinage-carrelage/tel-360x740-paysage-chromium/E6-vue-Plan.jpg`,
    steps: 'Téléphone en paysage → calepinage du sol de la salle de bain.',
    cause:
      'src/ui/calepinage/PoseEditorShell.svelte:83-86 : mise en page « ordinateur » (panneau à droite) seulement à partir de 1024 px de large ; idem src/ui/plan/PlanEditor.svelte:79.',
    reco: 'Panneau latéral dès que la largeur dépasse la hauteur et 640 px (paysage), outils en colonne à gauche comme sur ordinateur.',
  },
  {
    id: 'UX-01',
    screen: 'Calepinage carrelage, barre de résumé',
    devices: ALL,
    gravity: 'P2',
    axis: 'UX',
    finding:
      'La barre de résumé d’une pose affiche les totaux de tout le carrelage du projet : « 1171 carreaux · 585,15 € » pour un sol de 6,7 m² (347 carreaux posés). Rien ne dit qu’il s’agit du projet ; le chiffre ne bouge presque pas quand on change le motif de la pose.',
    proof: `${C}/calepinage-carrelage/${TEL}/N1-light.jpg ; ${C}/resultats-pose/${TEL}/N1-light.jpg`,
    steps: 'Projet maison → Salle de bain → Sol → Calepinage.',
    cause:
      'Choix assumé (docs/NAVIGATION.md §7 : chutes partagées sur le projet) mais résumé du module sans libellé ; src/modules/carrelage/ui/editor/Editor.svelte (summary).',
    reco: 'Résumé en deux parties : « Cette pose : 347 carreaux posés, 51 coupes » puis « À commander (tout le projet) : 47 cartons ».',
  },
  {
    id: 'UX-02',
    screen: 'Vue globale, Pièce, listes de poses',
    devices: ALL,
    gravity: 'P2',
    axis: 'texte',
    finding:
      'Les poses sont numérotées pour tout le projet, tous outils confondus (« Peinture · Pose 3 », « Carrelage · Pose 5 ») ; la liste « Sol et murs » de l’écran Pièce n’affiche même pas l’outil (« Mur 1 : Pose 2, Pose 3 »). L’artisan pense « crédence », « sol de la salle de bain ».',
    proof: `${C}/piece/${TEL}/N1-light.jpg ; ${C}/projet/${PC}/N1-light.jpg`,
    steps: 'Projet maison → Séjour.',
    cause: 'Nom par défaut « Pose n » (src/ui/room/cover.ts) ; liste dans src/ui/screens/Room.svelte:374-377.',
    reco: 'Nom par défaut descriptif (« Carrelage — Salle de bain, sol ») et l’outil toujours affiché ; renommage proposé.',
  },
  {
    id: 'UX-03',
    screen: 'Comparer #/p/:id/m/carrelage/compare',
    devices: ALL,
    gravity: 'P2',
    axis: 'UX',
    finding:
      'L’écran « Comparer » (scénarios A/B) existe et fonctionne mais aucun lien n’y mène (ni vue globale, ni calepinage, ni résultats) : fonction invisible.',
    proof: `${C}/comparer/${TEL}/N1-light.jpg ; ${M}/E8/*.json (liens-vers-comparer 0)`,
    steps: 'Chercher « Comparer » dans l’application.',
    cause: 'Route déclarée dans src/modules/carrelage/index.ts:54, aucun lien depuis les écrans N3–N5.',
    reco: 'Lien « Comparer deux réglages » dans le menu de la pose (titre) ou les résultats ; sinon retirer l’écran.',
  },
  {
    id: 'UX-04',
    screen: 'Mes projets (accueil vide)',
    devices: ALL,
    gravity: 'P2',
    axis: 'UX',
    finding:
      'L’accueil vide invite : « Vous utilisiez l’ancienne version ? Importez vos données. » Le lien mène aux Réglages, où il n’y a plus d’import (retiré en phase C4) : cul-de-sac. Le même texte reste affiché quand le stockage est plein.',
    proof: `${C}/reglages/${TEL}/A1-depuis-lien-import.jpg ; ${M}/A1/*.json`,
    steps: 'Premier lancement → lien « Importez vos données ».',
    cause: 'src/ui/screens/Home.svelte:30',
    reco: 'Retirer la phrase (docs/PLAN.md C4) ou la remplacer par une aide de démarrage.',
  },
  {
    id: 'PRJ-02',
    screen: 'Mes projets, carte d’un projet mixte',
    devices: ALL,
    gravity: 'P2',
    axis: 'UX',
    finding:
      'La carte d’un projet avec carrelage ne montre que le carrelage : « 3 surfaces · 21,96 m² » alors que la vue globale annonce 23,42 m² de carrelage, 11,6 m² de parquet, etc. ; la vignette est la première surface carrelée (une crédence), pas le plan. Les autres projets n’ont ni vignette ni chiffres.',
    proof: `${C}/accueil/${TEL}/N1-light.jpg ; ${C}/accueil/${TEL}/B6-sans-carrelage.jpg`,
    steps: 'Projet maison → Mes projets.',
    cause: 'src/modules/carrelage/ui/components/ProjectCard.svelte:31-66 (projectArea, première surface).',
    reco: 'Carte commune (PRJ-01) : vignette du plan, pièces, résumé par outil, coût total.',
  },
  {
    id: 'PRJ-03',
    screen: 'Mes projets, suppression',
    devices: ALL,
    gravity: 'P2',
    axis: 'robustesse',
    finding:
      'Supprimer un projet ne demande rien (annulable 6,5 s) ; si l’onglet ou l’application est fermé pendant ce délai, la suppression n’est jamais écrite : le projet revient au lancement suivant.',
    proof: `${M}/B5/*.json (apres-fermeture: projets 1)`,
    steps: 'Accueil → ⋯ → Supprimer → fermer l’onglet tout de suite → rouvrir.',
    cause: 'src/ui/lib/app.svelte.ts:157-176 (effacement dans un setTimeout, rien au pagehide).',
    reco: 'Écrire la suppression au pagehide (ou marquer le projet « à supprimer » tout de suite et l’effacer au démarrage suivant).',
  },
  {
    id: 'PAR-01',
    screen: 'Calepinage parquet, motifs bâton rompu et Hongrie ; Achats',
    devices: ALL,
    gravity: 'P2',
    axis: 'métier',
    finding:
      'Avec une lame sans variantes A et B (stratifié), le bâton rompu commande « Stratifié (lames A) : 268 lames » et « (lames B) : 269 lames » : deux références qui n’existent pas. L’avertissement « Cette lame n’a pas de lames A et B » n’empêche rien.',
    proof: `${C}/calepinage-parquet/${PC}/M1-hongrie-120m2.jpg ; ${M}/F3/*.json`,
    steps: 'Pièce 12 × 10 m → parquet stratifié → Bâton rompu → Résultats.',
    cause: 'src/modules/parquet/state/module.ts (lignes d’achat par variante quel que soit board.handed).',
    reco: 'Une seule ligne quand la lame n’a pas de variantes ; alerte bloquante ou proposition d’une lame A/B.',
  },
  {
    id: 'PAR-02',
    screen: 'Calepinage parquet, étape Pose',
    devices: ALL,
    gravity: 'P2',
    axis: 'métier',
    finding:
      'Le mur de référence (parallèle aux lames à 0°) ne se choisit nulle part : le modèle prévoit `layout.reference` mais aucun écran ne le règle. Seul l’angle permet de tourner la pose.',
    proof: `${M}/F2/*.json (axe-ou-reference: [])`,
    steps: 'Calepinage parquet → Pose : pas de choix du mur.',
    cause: 'src/modules/parquet/state/model.ts:44 (reference toujours null, src/modules/parquet/state/module.ts:167).',
    reco: 'Choix du mur de référence sur le dessin (toucher un mur) ou en liste dans l’étape Pose.',
  },
  {
    id: 'PAR-03',
    screen: 'Parquet : éditeur, vue globale, résultats',
    devices: ALL,
    gravity: 'P2',
    axis: 'texte',
    finding:
      'La « perte » n’a pas la même valeur selon l’écran : « perte 10 % » dans le résumé de l’éditeur et la vue globale, « Perte de la pose 4,6 % » dans les résultats ; « 52 lames » (à acheter) côtoie « Lames posées 64 » (morceaux). Même ambiguïté au carrelage : « Carreaux posés 22, Nécessaires 20, À commander 22 ».',
    proof: `${M}/F6/${PC}.json ; ${M}/E7/${PC}.json`,
    steps: 'Projet maison → parquet du séjour : comparer éditeur et résultats.',
    cause: 'Résumé du module (marge d’achat) et rapport (perte de coupe) nommés pareil.',
    reco: 'Deux termes distincts : « chutes de coupe 4,6 % » et « marge d’achat 10 % » ; « morceaux posés » au lieu de « lames posées ».',
  },
  {
    id: 'CAR-02',
    screen: 'Calepinage carrelage, étape Produit',
    devices: 'téléphones surtout',
    gravity: 'P2',
    axis: 'UX',
    finding:
      'Les 28 carreaux de la bibliothèque sont une seule liste de boutons radio, sans recherche ni filtre (sol/mur, format) : 2 150 px de haut sur téléphone. Les bibliothèques (28 à 33 produits) n’ont pas non plus de recherche.',
    proof: `${C}/calepinage-carrelage/${TEL}/E1-produit.jpg ; ${M}/E1/*.json ; ${M}/J5/*.json`,
    steps: 'Calepinage carrelage → Produit.',
    cause: 'src/modules/carrelage/ui/editor/TileTab.svelte:47-62 ; listes des bibliothèques.',
    reco: 'Champ de recherche, carreaux récents et du projet en tête, filtre par usage et format.',
  },
  {
    id: 'CAR-03',
    screen: 'Pièce → Revêtir : carrelage (sol)',
    devices: ALL,
    gravity: 'P2',
    axis: 'métier',
    finding:
      'Un sol revêtu de carrelage reçoit par défaut « Carreau métro 20 × 10 cm » (faïence murale, 7 mm) : produit de mur posé au sol sans alerte.',
    proof: `${C}/calepinage-carrelage/${TEL}/N1-light.jpg ; ${M}/E1/*.json (carreau-choisi)`,
    steps: 'Nouveau projet → Pièce → Sol → Revêtir : carrelage → Calepinage.',
    cause: 'Carreau par défaut de createPose (premier modèle type), indépendant de la surface.',
    reco: 'Carreau par défaut selon la surface (grès 60 × 60 au sol, faïence au mur) et alerte « carreau de mur posé au sol ».',
  },
  {
    id: 'ACH-02',
    screen: 'Achats, saisie des prix',
    devices: ALL,
    gravity: 'P2',
    axis: 'robustesse',
    finding:
      'Une saisie invalide efface le prix existant : « abc » efface le prix (toast « effacé »), « -3 » aussi alors que le champ affiche encore « -3 » ; « 0 » efface (impossible de noter un article gratuit ou déjà en stock). Les toasts s’empilent à chaque saisie.',
    proof: `${M}/J2/${PC}.json`,
    steps: 'Achats → prix du stratifié : 12,5 puis abc.',
    cause: 'src/ui/screens/Shopping.svelte:33-46',
    reco: 'Refuser la saisie invalide en gardant l’ancien prix, avec un message sous le champ ; accepter 0 € ; un seul toast remplacé.',
  },
  {
    id: 'A11Y-01',
    screen: 'Tous les écrans',
    devices: ALL,
    gravity: 'P2',
    axis: 'a11y',
    finding:
      'Le titre du document reste « PilePoil » sur tous les écrans (WCAG 2.4.2) : onglets, historique et lecteurs d’écran n’annoncent pas l’écran ; les éditeurs de calepinage (carrelage, parquet, peinture) n’ont pas de titre h1.',
    proof: `${M}/N1/*.json (title, h1)`,
    steps: 'Naviguer entre les écrans en regardant l’onglet.',
    cause:
      'Aucun document.title par route (src/ui/lib/router.svelte.ts) ; en-tête de src/ui/calepinage/PoseEditorShell.svelte:116-126 sans h1.',
    reco: 'Titre « <écran> — <projet> · PilePoil » à chaque route ; h1 (visuellement discret) dans les éditeurs.',
  },
  {
    id: 'A11Y-02',
    screen: 'Fiche carreau, Achats (texte agrandi à 200 %)',
    devices: 'téléphones et ordinateur',
    gravity: 'P2',
    axis: 'a11y',
    finding:
      'Avec le texte à 200 %, la fiche carreau déborde de 73 px en largeur sur téléphone (boutons de formats courants) et les achats de 16 px sur ordinateur : défilement horizontal (WCAG 1.4.4 / 1.4.10).',
    proof: `${C}/fiche-carreau/${TEL}/N3-texte200.jpg ; ${M}/N3/*.json`,
    steps: 'Agrandir le texte du navigateur à 200 % → #/library/tiles/modele-gres-60x60.',
    cause:
      'Rangée de boutons « Formats courants » sans retour à la ligne (TileForm.svelte) ; colonne prix des achats à largeur fixe.',
    reco: 'flex-wrap sur les rangées de boutons ; colonnes des achats en grille qui passe sous le libellé.',
  },
  {
    id: 'PERF-01',
    screen: 'Mes projets, Vue globale, Résultats (téléphone)',
    devices: 'téléphones Chromium (Lighthouse mobile)',
    gravity: 'P2',
    axis: 'perf',
    finding:
      'Lighthouse mobile sous l’objectif de 90 (docs/PLAN.md P5) avec un projet : accueil 75 (TBT 1,4 s), vue globale 72 (TBT 2,35 s), résultats 80 (CLS 0,38). Sur ordinateur, résultats 94 avec CLS 0,15.',
    proof: 'docs/audit/mesures/performance.md (M3)',
    steps: 'Lighthouse mobile sur #/ et #/p/:id avec le projet maison.',
    cause:
      'Vignettes et résumés calculés au chargement (Home → ProjectCard, Project.svelte:33-48) ; onglets des résultats qui se remplissent après coup (Results.svelte).',
    reco: 'Différer les vignettes (requestIdleCallback, mise en cache par empreinte du projet) ; réserver la hauteur des résultats.',
  },
  {
    id: 'AIDE-01',
    screen: 'Toute l’application',
    devices: ALL,
    gravity: 'P2',
    axis: 'UX',
    finding:
      'Il n’y a ni aide, ni prise en main, ni glossaire : « pose », « zone », « bande », « calepinage », « coupe fine », « coupe perdue », « État des lieux / Travaux » ne sont expliqués nulle part ; « À propos » ne parle que du carrelage.',
    proof: `${M}/K2/*.json (aide: 0 lien)`,
    steps: 'Réglages → À propos.',
    cause: 'src/ui/screens/Settings.svelte:137-144',
    reco: 'Prise en main en 3 écrans au premier lancement, aide contextuelle (i) sur les termes métier, page « Comment ça marche ».',
  },
  /* ---------- P3 ---------- */
  {
    id: 'PLAN-06',
    screen: 'Plan, messages d’erreur',
    devices: ALL,
    gravity: 'P3',
    axis: 'texte',
    finding:
      'Trois points alignés (aire nulle) donnent « Les murs se croisent » ; la forme en U trop étroite dit « Le retrait doit rester plus petit que la pièce » (le U a des « ailes » et une « encoche ») ; renommer un projet avec un nom vide ne fait rien, sans message.',
    proof: `${C}/plan/${TEL}/C4-aire-nulle.jpg ; ${C}/nouveau-projet/${TEL}/B2-forme-U-erreur.jpg`,
    steps: 'Dessin : 3 points alignés → Terminer ; Nouveau projet → En U → ailes 600.',
    cause:
      'src/ui/plan/planState.svelte.ts:495 ; src/ui/plan/AddRoomDialog.svelte:95 ; src/ui/plan/PlanEditor.svelte:39-45',
    reco: 'Messages propres à chaque cas (« Les points sont alignés : la pièce n’a pas de surface », « Les ailes doivent laisser une encoche »).',
  },
  {
    id: 'PLAN-07',
    screen: 'Plan et calepinage : annuler après rechargement',
    devices: ALL,
    gravity: 'P3',
    axis: 'robustesse',
    finding:
      'L’historique d’annulation est perdu au rechargement (Annuler grisé), et la dernière modification est perdue si la page se recharge moins de 0,3 s après (tirer pour actualiser).',
    proof: `${M}/C11/*.json ; ${M}/L2/*.json`,
    steps: 'Plan → modifier une cote → recharger : Annuler est grisé.',
    cause:
      'Historique en mémoire (src/state/history.ts) ; enregistrement différé de 300 ms (src/storage/autosave.ts:8) et flush asynchrone au pagehide.',
    reco: 'Garder les 20 derniers états dans IndexedDB par projet ; enregistrer aussi au visibilitychange.',
  },
  {
    id: 'PLAN-08',
    screen: 'Plan',
    devices: 'ordinateur',
    gravity: 'P3',
    axis: 'UX',
    finding:
      'Le plan n’a pas les raccourcis du calepinage : ni Ctrl+Z / Ctrl+Y, ni + / − / 0 pour zoomer (le calepinage carrelage les a).',
    proof: `${M}/C9/${PC}.json (clavier-plus sans effet) ; ${M}/C11/*.json (ctrl-z n/a)`,
    steps: 'Plan → cliquer le dessin → Ctrl+Z, +.',
    cause: 'src/ui/plan/PlanCanvas.svelte:283-300 (seulement Échap et Suppr)',
    reco: 'Mêmes raccourcis partout (coquille).',
  },
  {
    id: 'PLAN-09',
    screen: 'Plan, travaux',
    devices: ALL,
    gravity: 'P3',
    axis: 'texte',
    finding:
      'Une cloison qui coupe une pièce crée « Séjour (2) » sans proposer de nom ; ce nom se retrouve dans les résultats, le PDF et les achats.',
    proof: `${C}/projet/${PC}/N1-light.jpg`,
    steps: 'Plan → Travaux → Tracer une cloison au milieu du séjour.',
    cause: 'core/plan/derive.ts (nommage des pièces dérivées)',
    reco: 'Demander le nom de la nouvelle pièce à la fin du tracé, comme pour un dessin.',
  },
  {
    id: 'PLAN-10',
    screen: 'Plan, étiquettes',
    devices: 'téléphones',
    gravity: 'P3',
    axis: 'UI',
    finding: 'Le nom d’une petite pièce déborde de son contour et recouvre le mur (« Salle de bain »).',
    proof: `${C}/plan/${TEL}/N1-light.jpg`,
    steps: 'Plan du projet maison sur téléphone.',
    cause: 'src/ui/plan/PlanCanvas.svelte (étiquettes de pièce à taille fixe)',
    reco: 'Réduire ou abréger l’étiquette quand elle ne tient pas.',
  },
  {
    id: 'NOU-01',
    screen: 'Nouveau projet #/new',
    devices: ALL,
    gravity: 'P3',
    axis: 'UX',
    finding:
      '« Annuler » dans « Nouveau projet » laisse un éditeur de plan vide sur #/new (« Mon projet, Plan des pièces ») au lieu de revenir à l’accueil.',
    proof: `${C}/nouveau-projet/${TEL}/B1-annule.jpg`,
    steps: 'Accueil → Nouveau projet → Annuler.',
    cause: 'src/ui/plan/AddRoomDialog.svelte:102 (ferme seulement la fenêtre)',
    reco: 'Annuler un projet neuf ramène à l’accueil.',
  },
  {
    id: 'PIE-02',
    screen: 'Pièce, revêtir',
    devices: ALL,
    gravity: 'P3',
    axis: 'UX',
    finding:
      'Le parquet n’est pas proposé sur un mur : le bouton est absent au lieu d’être grisé avec la raison (docs/NAVIGATION.md §4) ; après « Revêtir », il faut encore toucher « Calepinage » pour régler la pose.',
    proof: `${M}/D2/*.json`,
    steps: 'Pièce → Mur 1.',
    cause: 'src/ui/room/cover.ts (modulesFor filtre) ; src/ui/screens/Room.svelte:352-356',
    reco: 'Bouton grisé avec « Le parquet se pose au sol » ; ouvrir le calepinage après une première pose.',
  },
  {
    id: 'PIE-03',
    screen: 'Pièce, zone de mur',
    devices: ALL,
    gravity: 'P3',
    axis: 'texte',
    finding:
      'Hauteurs incohérentes : le message « Le haut de la zone doit être au-dessus du bas » s’affiche deux fois dans le même toast et reste après une saisie correcte ; « Jusqu’à 400 cm » devient 250 cm sans message.',
    proof: `${M}/D5/*.json`,
    steps: 'Pièce → Mur 1 → Depuis le sol 150, Jusqu’à 90.',
    cause: 'src/ui/screens/Room.svelte:143-150',
    reco: 'Message sous le champ, effacé dès que la saisie est correcte ; dire quand la hauteur est bornée à celle de la pièce.',
  },
  {
    id: 'CAR-04',
    screen: 'Calepinage carrelage, liste des carreaux',
    devices: ALL,
    gravity: 'P3',
    axis: 'texte',
    finding:
      'Formats incohérents : « 1194 × 596 mm » à côté de « 90 × 30 cm », et l’ordre des côtés change entre le nom (« 59,6 × 119,4 ») et la taille (« 1194 × 596 mm »).',
    proof: `${C}/calepinage-carrelage/${PC}/N1-light.jpg`,
    steps: 'Calepinage carrelage → Produit.',
    cause: 'tileSize() dans src/modules/carrelage/ui/editor/TileTab.svelte:57',
    reco: 'Toujours en cm, largeur × longueur dans le même ordre que le nom.',
  },
  {
    id: 'CAR-05',
    screen: 'Calepinage carrelage',
    devices: ALL,
    gravity: 'P3',
    axis: 'UX',
    finding:
      'Optimiser : pas de barre de progression accessible (le texte du bouton change seulement) et aucun message quand le départ est déjà le meilleur ; le bouton flottant « Optimiser » masque le coin du dessin.',
    proof: `${C}/calepinage-carrelage/${TEL}/E3-optimisation.jpg ; ${M}/E3/*.json`,
    steps: 'Calepinage → Optimiser.',
    cause: 'src/modules/carrelage/ui/editor/Editor.svelte',
    reco: 'role=progressbar, message « Départ déjà optimal » ou « 3 coupes fines en moins » ; bouton hors du dessin.',
  },
  {
    id: 'CAR-06',
    screen: 'Calepinage carrelage, réservations et bandes',
    devices: ALL,
    gravity: 'P3',
    axis: 'robustesse',
    finding:
      'Une réservation de 5 m sur un mur de 4,7 m est acceptée ; « -20 » cm devient 0 sans message ; marge de casse 100 % devient 50 % sans message.',
    proof: `${M}/E4/*.json ; ${M}/E5/*.json`,
    steps: 'Calepinage murs salle de bain → Découpage → Ajouter → Largeur 5000.',
    cause: 'NumberField (bornes silencieuses), OpeningsTab.svelte',
    reco: 'Bornes visibles et message quand la valeur est corrigée.',
  },
  {
    id: 'TXT-01',
    screen: 'Résultats, PDF',
    devices: ALL,
    gravity: 'P3',
    axis: 'texte',
    finding:
      'Le bouton des résultats d’une pose de peinture s’appelle « PDF du calepinage » ; titres « Carrelage · Pose 5 » et fil « Carrelage – Pose 5 » (deux séparateurs) ; « 0 projet, enregistrés » dans les réglages.',
    proof: `${M}/G3/*.json ; ${C}/resultats-pose/${TEL}/N1-dark.jpg ; ${M}/K1/*.json`,
    steps: 'Résultats d’une pose de peinture ; Réglages sans projet.',
    cause: 'src/ui/screens/Results.svelte ; src/ui/screens/Settings.svelte:85',
    reco: '« PDF de la pose » ; un seul séparateur ; accord du pluriel.',
  },
  {
    id: 'ROB-03',
    screen: 'Achats, export',
    devices: ALL,
    gravity: 'P3',
    axis: 'robustesse',
    finding:
      'Trois clics rapides sur « Exporter en PDF » produisent trois fichiers (le bouton n’est pas désactivé pendant la création), contrairement aux résultats.',
    proof: `${M}/L8/*.json (pdf-triple 3)`,
    steps: 'Achats → triple clic sur Exporter en PDF.',
    cause: 'src/ui/screens/Shopping.svelte (exportPdf sans état « en cours »)',
    reco: 'Même état busy que Results.svelte.',
  },
  {
    id: 'ROB-04',
    screen: 'Stockage indisponible',
    devices: ALL,
    gravity: 'P3',
    axis: 'texte',
    finding:
      'L’écran « Impossible d’ouvrir vos données » s’affiche avec le toast « PilePoil fonctionne maintenant sans connexion » : deux messages contradictoires.',
    proof: `${C}/accueil/${TEL}/L9-stockage-indisponible.jpg`,
    steps: 'Navigation privée sans IndexedDB.',
    cause: 'src/ui/lib/pwa.svelte.ts:60 (toast indépendant de app.fatal)',
    reco: 'Ne pas afficher le toast hors ligne quand l’application n’a pas pu démarrer.',
  },
  {
    id: 'BIB-01',
    screen: 'Bibliothèques, produit utilisé',
    devices: ALL,
    gravity: 'P3',
    axis: 'UX',
    finding:
      'Supprimer un produit utilisé est refusé avec une explication claire, mais seulement « Compris » : pas de lien vers le projet ni d’action « Remplacer par… ».',
    proof: `${C}/fiche-tiles/${TEL}/J6-utilise.jpg ; ${M}/J6/*.json`,
    steps: 'Bibliothèque → carreau métro → Supprimer le carreau.',
    cause: 'src/ui/components/ItemInUseDialog.svelte',
    reco: 'Lien « Ouvrir le projet » et remplacement par un autre produit.',
  },
  {
    id: 'PERF-02',
    screen: 'Chargement',
    devices: ALL,
    gravity: 'P3',
    axis: 'perf',
    finding:
      '2,6 Mo de fichiers précachés (195 fichiers) ; jsPDF 390 Ko et html2canvas 195 Ko (dépendance de jsPDF, sans doute inutile ici) ; scène 3D 372 Ko.',
    proof: `${M}/M4/${PC}.json`,
    steps: 'npm run build.',
    cause: 'vite.config.ts (precache), import de jspdf',
    reco: 'Exclure html2canvas et purify (jsPDF sans .html()) ; précharger la 3D et le PDF seulement après le premier écran.',
  },
  {
    id: 'UI-04',
    screen: 'Fiche carreau et réglages (WebKit, texte agrandi)',
    devices: 'iPhone 360 px (WebKit) ; texte à 200 % sur tous les téléphones',
    gravity: 'P2',
    axis: 'UI',
    finding:
      'Sous WebKit à 360 px, la fiche carreau déborde de 6 px à droite (la page défile latéralement, le bord droit des champs touche l’écran). Avec le texte à 200 %, le débordement atteint 73 px sous Chromium et 262 à 332 px sous WebKit (fiche carreau), 76 à 146 px dans les Réglages sous WebKit : formats courants et rangées de boutons sans retour à la ligne.',
    proof: `${C}/fiche-carreau/tel-360x740-portrait-webkit/N1-light.jpg ; ${C}/fiche-carreau/tel-390x844-portrait-webkit/N3-texte200.jpg ; docs/audit/mesures/controles.md`,
    steps: 'iPhone SE (ou 360 px WebKit) → #/library/tiles/modele-gres-60x60 ; puis texte à 200 %.',
    cause:
      'Rangées sans retour à la ligne dans src/modules/carrelage/ui/components/TileForm.svelte (formats courants, forme) et Segmented de largeur fixe ; contenu plus large que la colonne sous WebKit.',
    reco: 'Segmented et rangées de pastilles à retour à la ligne, min-width:0 sur les conteneurs de formulaire ; test « pas de défilement horizontal » à 360 px et à 200 % dans la suite e2e.',
  },
  {
    id: 'UI-05',
    screen: 'Plan et calepinage sur tablette 768 px',
    devices: 'tablettes 768 × 1024 (portrait et paysage)',
    gravity: 'P3',
    axis: 'UI',
    finding:
      'Sous 1024 px de large, les tablettes reçoivent la mise en page téléphone : plan limité à la moitié haute, panneau tiré qui occupe le reste (boutons étirés sur plus de 700 px). Un iPad de 768 px a pourtant la place d’un panneau latéral.',
    proof: `${C}/plan/tab-768x1024-portrait-webkit/N1-light.jpg`,
    steps: 'Plan du projet maison sur un écran de 768 × 1024.',
    cause:
      'Seuil unique min-width:1024px (src/ui/plan/PlanEditor.svelte:79, src/ui/calepinage/PoseEditorShell.svelte:83).',
    reco: 'Panneau latéral dès 700 px de large (paysage compris), panneau tiré seulement en dessous.',
  },
  {
    id: 'UX-05',
    screen: 'Résultats, onglet Détail (téléphone)',
    devices: 'téléphones',
    gravity: 'P3',
    axis: 'UX',
    finding:
      'L’onglet Détail des résultats du projet fait environ 11 300 px de haut sur téléphone (14 écrans de défilement) : fiche de coupe de chaque rang et de chaque plaque à la suite, sans sommaire ni repli par pose.',
    proof:
      'docs/audit/mesures/echecs.md (I1 : capture pleine page impossible au-delà de 32 767 px sous WebKit) ; hauteur mesurée 11 341 px sur 390 × 844',
    steps: 'Résultats du projet maison → Détail.',
    cause: 'src/ui/screens/Results.svelte (onglet Détail sans repli), sections des modules.',
    reco: 'Sections repliables par pose, lien « aller à… » en tête, fiche de coupe ouverte seulement pour la pose consultée.',
  },
  {
    id: 'A11Y-03',
    screen: 'Pièce (murs dépliés), Résultats, Plan (panneau plein)',
    devices: 'téléphones et ordinateur (25 appareils pour le lien de cloison)',
    gravity: 'P3',
    axis: 'a11y',
    finding:
      'Cibles sous 44 px : murs étroits de l’écran Pièce (26 × 66 et 66 × 21 px, 16 appareils) ; lien « Cloison 1 » des résultats (21 px de haut) ; « Voir tout le plan » trop près d’une autre cible quand le panneau est ouvert en paysage (axe target-size) ; bouton « Optimiser » à 200 %.',
    proof: `${C}/plan/tel-375x667-paysage-chromium/C10-panneau-plein.jpg ; docs/audit/mesures/controles.md`,
    steps: 'Écran Pièce d’un L ; résultats du projet ; plan en paysage, panneau plein.',
    cause:
      'src/ui/room/RoomDrawing.svelte (zone de toucher = le mur déplié) ; src/ui/screens/Results.svelte (lien en ligne) ; src/ui/plan/PlanEditor.svelte (bouton flottant).',
    reco: 'Zone de toucher élargie autour des murs fins (la liste de surfaces existe comme alternative) ; lien de cloison en bouton de 44 px ; écarter le bouton flottant.',
  },
  {
    id: 'DOC-01',
    screen: 'Documents',
    devices: '—',
    gravity: 'P3',
    axis: 'texte',
    finding:
      'Écarts documents ↔ code : docs/UX.md décrit l’ancienne application (assistant 4 étapes, onglets Commande / Découpe / Achats / Encollage, écran Surface) ; docs/BOITE.md parle du calque « Existant », l’écran dit « État des lieux » ; NAVIGATION.md §4 veut le parquet grisé sur un mur, il est absent ; NAVIGATION.md §6 promet la même coquille, parquet et carrelage ont des outils de vue différents.',
    proof: 'docs/audit/CARTOGRAPHIE.md §3',
    steps: '—',
    cause: '—',
    reco: 'Mettre docs/UX.md à jour depuis NAVIGATION.md (sans trancher ici).',
  },
];

if (process.argv[1]?.endsWith('constats.ts')) {
  const root = join(import.meta.dirname, '..', '..', 'docs', 'audit');
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = [
    'ID',
    'Écran / route',
    'Appareils',
    'Gravité',
    'Axe',
    'Constat',
    'Preuve',
    'Reproduction',
    'Cause probable',
    'Recommandation',
  ];
  const rows = FINDINGS.map((f) =>
    [f.id, f.screen, f.devices, f.gravity, f.axis, f.finding, f.proof, f.steps, f.cause, f.reco].map(q).join(';'),
  );
  writeFileSync(join(root, 'constats.csv'), '﻿' + [head.map(q).join(';'), ...rows].join('\r\n') + '\r\n');
  let md = '# Constats détaillés\n\nSource : `tests/audit/constats.ts` (régénère ce fichier et `constats.csv`).\n\n';
  for (const g of ['P0', 'P1', 'P2', 'P3'] as const) {
    const fs = FINDINGS.filter((f) => f.gravity === g);
    md += `## ${g} (${fs.length})\n\n`;
    for (const f of fs)
      md += `### ${f.id} — ${f.screen}\n\n**${f.axis}** · ${f.devices}\n\n${f.finding}\n\n- Preuve : ${f.proof}\n- Reproduire : ${f.steps}\n- Cause probable : ${f.cause}\n- Recommandation : ${f.reco}\n\n`;
  }
  writeFileSync(join(root, 'CONSTATS.md'), md);
  const n = (g: string) => FINDINGS.filter((f) => f.gravity === g).length;
  console.log(`${FINDINGS.length} constats : P0 ${n('P0')}, P1 ${n('P1')}, P2 ${n('P2')}, P3 ${n('P3')}`);
}
