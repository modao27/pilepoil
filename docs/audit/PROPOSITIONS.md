# Propositions issues de l'audit

À partir des constats seulement (identifiants de [`CONSTATS.md`](CONSTATS.md)). Rien n'est mis en œuvre : à choisir.
Effort : S (≤ 1 jour), M (2 à 4 jours), L (≥ 1 semaine). Risque parité : risque de toucher le moteur carrelage comparé à
`legacy/` (tests de parité, y compris les clés et quantités d'achat, `tests/parity/parity.test.ts:216`).

## 1. Corrections, par lots

| Lot | Constats couverts | Gravité | Effort | Fichiers touchés | Risque parité |
|---|---|---|---|---|---|
| **A. Projets fiables** — carte de projet commune avec menu pour tous, suppression écrite tout de suite (ou au `pagehide`), accueil vide sans lien mort, « Annuler » d'un projet neuf ramène à l'accueil | PRJ-01, PRJ-02, PRJ-03, UX-04, NOU-01 | 1 × P1, 3 × P2, 1 × P3 | M | `src/ui/screens/Home.svelte`, nouveau `src/ui/components/ProjectCard.svelte`, `src/modules/carrelage/ui/components/ProjectCard.svelte` (devient vignette facultative), `src/ui/lib/app.svelte.ts`, `src/ui/plan/AddRoomDialog.svelte` | aucun |
| **B. Plan précis au doigt** — vue figée pendant un glissement, Suppr avec la même confirmation, fermeture du dessin au toucher, position des obstacles en cotes, messages d'erreur justes, raccourcis du calepinage, étiquettes qui tiennent | PLAN-01, PLAN-02, PLAN-03, PLAN-05, PLAN-06, PLAN-08, PLAN-09, PLAN-10 | 2 × P1, 2 × P2, 4 × P3 | M | `src/ui/plan/PlanCanvas.svelte`, `PlanPanel.svelte`, `PlanEditor.svelte`, `planState.svelte.ts`, `AddRoomDialog.svelte` | aucun (`core/plan` inchangé) |
| **C. Liste d'achat juste** — quantité et unité toujours affichées (écran, PDF), détail des rails et montants, vannerie regroupée par carreau dans l'adaptateur, une seule ligne pour une lame sans A/B, export verrouillé pendant la création, saisie de prix sans perte | ACH-01, CAR-01, PAR-01, ACH-02, ROB-03 | 2 × P1, 2 × P2, 1 × P3 | M | `src/ui/screens/Shopping.svelte`, `src/ui/lib/shoppingPdf.ts`, `src/modules/cloisons/state/module.ts`, `src/modules/carrelage/state/module.ts` (adaptateur seulement), `src/modules/parquet/state/module.ts` | faible si l'on ne touche que l'adaptateur ; **élevé** si l'on change les clés du moteur |
| **D. Données entre onglets et calcul bloqué** — diffusion des enregistrements (BroadcastChannel) et refus d'une écriture périmée, erreur du worker affichée avec « Recharger », historique d'annulation conservé, pas de toast contradictoire | ROB-01, ROB-02, PLAN-07, ROB-04 | 1 × P1, 1 × P2, 2 × P3 | M | `src/ui/lib/app.svelte.ts`, `src/storage/repo.ts`, `src/workers/client.ts`, `src/state/history.ts`, `src/ui/lib/pwa.svelte.ts` | aucun |
| **E. Saisie des nombres** — unités dans les expressions, refus expliqué sans perte, bornes annoncées, alerte de vraisemblance, champs en 16 px | PLAN-04, UI-01, CAR-06, PIE-03 | 2 × P2, 2 × P3 | M | `src/ui/lib/calc.ts` (+ tests), `src/ui/components/NumberField.svelte`, `TextField.svelte`, `Select.svelte`, `src/ui/design/tokens.css` ou `typo.css`, `src/ui/screens/Room.svelte` | aucun |
| **F. Lire une pose** — résumé « cette pose / à commander pour le projet », noms de pose descriptifs et outil toujours affiché, deux mots pour deux pertes, libellés et formats homogènes, lien vers le projet d'un produit utilisé | UX-01, UX-02, PAR-03, TXT-01, CAR-04, CAR-05, BIB-01 | 3 × P2, 4 × P3 | S à M | `src/modules/*/ui` (résumés), `src/ui/room/cover.ts`, `src/ui/screens/Room.svelte`, `Results.svelte`, `Settings.svelte`, `ui/lib/coverageMessages.ts` | aucun (textes) |
| **G. Éditeurs alignés** — mêmes outils de vue pour le parquet (cotes, zoom), liste de lame à la largeur, mur de référence du parquet, recherche de carreau, carreau par défaut selon la surface, découpe qui n'est pas quittée au bord, parquet grisé sur un mur, accès à Comparer | UI-02, PAR-02, CAR-02, CAR-03, PIE-01, PIE-02, UX-03 | 6 × P2, 1 × P3 | L | `src/modules/parquet/ui/components/ParquetEditor.svelte`, `ParquetPlan.svelte`, `src/modules/carrelage/ui/editor/TileTab.svelte`, `src/ui/room/*`, `src/ui/screens/Room.svelte`, `createPose` des modules | faible (UI ; le carreau par défaut ne change pas le moteur) |
| **H. Accessibilité et chargement** — titre de document par écran, h1 dans les éditeurs, rangées qui passent à la ligne à 200 %, vignettes différées, CLS des résultats, html2canvas retiré | A11Y-01, A11Y-02, PERF-01, PERF-02 | 3 × P2, 1 × P3 | S à M | `src/ui/lib/router.svelte.ts`, `src/ui/calepinage/PoseEditorShell.svelte`, `TileForm.svelte`, `Shopping.svelte`, `Results.svelte`, `Project.svelte`, `vite.config.ts` | aucun |
| **I. Documents** — `docs/UX.md` remis d'accord avec `NAVIGATION.md` et le code, vocabulaire des calques | DOC-01 | P3 | S | `docs/UX.md`, `docs/BOITE.md` | aucun |

Ordre conseillé des lots : A, C, B, D, E, F, H, G, I (voir § 4).

## 2. Améliorations UX

**Accueil et projets** (PRJ-01, PRJ-02, B7) — Carte commune : vignette du plan, résumé par outil, coût, menu complet ;
recherche et tri dès 6 projets ; « Exporter le projet » dans le menu (voir § 3). Maquette :
[`maquettes/carte-projet.html`](maquettes/carte-projet.html).

**Prise en main et aide** (AIDE-01, UX-04) — Au premier lancement, trois écrans : « Dessinez vos pièces », « Touchez une
surface pour la revêtir », « Commandez juste ce qu'il faut » ; projet d'exemple « Maison Dupont » à ouvrir en un geste
(le jeu de données de l'audit) ; un (i) à côté des termes métier (calepinage, pose, bande, coupe fine, coupe perdue, rang
de bord, État des lieux / Travaux) ouvrant une phrase d'explication ; une page « Comment ça marche » dans les Réglages.

**Saisie des cotes** (PLAN-04, UI-01, CAR-06) — Unités acceptées, refus expliqué, alerte de vraisemblance avec correction
proposée, pas de +/− de 1 cm seulement (appui long : 10 cm). Maquette :
[`maquettes/saisie-cote.html`](maquettes/saisie-cote.html).

**Calepinage** (UX-01, CAR-05, UI-02, CAR-02) — Résumé en deux parties (cette pose / à commander pour le projet),
maquette [`maquettes/resume-calepinage.svg`](maquettes/resume-calepinage.svg) ; retour d'« Optimiser » chiffré
(« 3 coupes fines en moins ») ; mêmes outils de vue pour tous les revêtements ; carreaux récents et du projet en tête.

**Plan au doigt** (PLAN-01, PLAN-03, PLAN-05, PIE-01) — Vue figée pendant les gestes, loupe au-dessus du doigt lors d'un
glissement de coin (la cote s'affiche en grand), fermeture du dessin par le premier point fiable, points de découpe
aimantés au bord.

**Navigation** (UX-03, A11Y-01, NOU-01) — « Comparer deux réglages » dans le menu d'une pose ; titres de page ; retour
d'un projet neuf annulé vers l'accueil.

**Mode chantier** — Le mode chantier du parquet a été retiré le 2026-10-15 (`docs/BOITE.md` §11). L'audit n'a pas de
constat qui le réclame directement ; si l'idée revient, la proposer au niveau de la coquille (§ 3, « Chantier sur
plusieurs jours ») plutôt que par module, et en tenant compte de cette décision.

**Retours visuels** (PIE-03, ACH-02, ROB-03) — Messages sous le champ plutôt qu'en toast, un seul toast remplacé, boutons
d'export occupés pendant la création.

## 3. Nouvelles fonctionnalités

Le module cloisons placo cité dans la consigne existe déjà (T0, CL1 à CL3 : relevé de l'existant, cloisons, démolitions,
rails, montants, plaques) ; les propositions portent sur ses suites.

| Fonction | Problème résolu | Pour qui | Impact | Effort | Dépendances | Place dans `docs/PLAN.md` | Contrat de module (`docs/BOITE.md` §2) |
|---|---|---|---|---|---|---|---|
| **Exporter / importer un projet** (fichier `.pilepoil`, JSON) | Rien ne quitte l'appareil : pas de sauvegarde, pas de passage téléphone ↔ ordinateur (préparer au bureau, poser au chantier), données perdues si le navigateur efface | artisan seul, bureau + chantier | fort | M | migrations existantes (`storage/migrations.ts`), photos à embarquer | nouvelle phase « D1 — Données portables » après F1 | coquille seule ; les modules n'ont rien à faire (données déjà sérialisables) |
| **Devis client** (PDF avec fournitures, main d'œuvre au m² ou au forfait par outil, TVA 10 / 20 %, logo et coordonnées de l'entreprise) | L'artisan refait le devis ailleurs à partir de la liste d'achat | artisan | fort | M à L | prix des achats (existants), réglages entreprise | phase « D2 — Devis » | ajout facultatif `labour?(result): LabourLine[]` (surface, unité, prestation par défaut) ; sinon tarifs saisis dans la coquille par outil |
| **Relevé rapide sur place** (mur après mur : longueur, angle droit ou mesuré, « fermer » ; cotes dictées ; diagonales de contrôle) | Le dessin libre au doigt est imprécis (PLAN-01, PLAN-03) ; sur chantier on mesure au mètre ou au laser, mur par mur | artisan, bricoleur | fort | M | `core/plan` (rooms depuis une suite de murs) | phase plan « T1 — Relevé » | coquille et `core/plan` ; aucun module touché |
| **Photos du chantier** rattachées à une pièce ou un mur (avant / pendant / après, annotation simple) | Mémoire du chantier, preuve pour le client, repérage des réseaux avant de percer | artisan | moyen | M | magasin `photos` existant, appareil photo (input capture) | phase « D3 — Photos » | coquille ; un module peut afficher les photos d'une surface (lecture seule) |
| **Fiche chantier imprimable** par pièce (plan coté, ordre de pose, coupes, consommables, en A4 paysage, gros caractères) | Le PDF actuel est un dossier ; en chantier il faut une page par pièce lisible de loin | artisan, poseur | moyen | S à M | PDF commun (`ui/lib/pdf`) | avec N5 / résultats | `results().pdf` par pièce existe : nouvelle mise en page côté coquille |
| **Chantier sur plusieurs jours** (cases « fait » par pose ou par rang, reste à poser et à acheter) | Savoir où l'on en est le lendemain, ce qui reste à commander | artisan | moyen | M à L | décision du 2026-10-15 (mode chantier retiré) à rediscuter | après D1 | coquille : état « fait » par zone ou par pose ; un module peut détailler (rangs) via une méthode facultative |
| **Doublages et plafonds placo** (contre-cloison sur un mur existant, faux plafond, isolation) | Les cloisons ne couvrent que les cloisons neuves ; la rénovation commence souvent par les doublages | artisan placo | fort | L | `core/plan` (faces des murs existants), plafonds = PE5 | suite de CL3 (« CL4 ») et PE5 | dans le module cloisons ; plafond comme nouvelle `SurfaceRef` (prévue en PE5) |
| **Ragréage et chape** (épaisseur, sacs, eau, temps de séchage avant pose) | Étape avant carrelage et parquet, souvent oubliée dans la liste d'achat | artisan, bricoleur | moyen | S à M | plan (sols) | nouveau module « RG1 » | nouveau module standard (`coverage` sol, `shopping`), sans toucher aux autres |
| **Prix fournisseur** (import d'une liste de prix CSV, prix par magasin, date du prix) | Les prix sont saisis un par un à chaque projet | artisan | moyen | M | bibliothèques, achats | après B1 | coquille et bibliothèques ; `priceAction` inchangé |
| **Partage en lecture** (lien ou PDF interactif pour le client, sans compte) | Montrer le projet au client | artisan | faible à moyen | L (serveur) ou S (PDF) | synchronisation hors périmètre (`docs/PLAN.md`) | plus tard | — |

## 4. Classement impact / effort et ordre proposé

| Rang | Proposition | Impact | Effort | Pourquoi maintenant |
|---|---|---|---|---|
| 1 | Lot A — Projets fiables | fort | M | P1 bloquant pour tout projet sans carrelage ; base de la carte commune et de l'export. |
| 2 | Lot C — Liste d'achat juste | fort | M | Erreurs d'argent visibles par le client (P1 ×2) ; corrigeable sans toucher au moteur. |
| 3 | Lot B — Plan précis au doigt | fort | M | P1 ×2 sur l'écran le plus utilisé au téléphone. |
| 4 | Lot E — Saisie des nombres | fort | M | Erreurs de cotes silencieuses, zoom iOS sur chaque champ. |
| 5 | Exporter / importer un projet | fort | M | Seule protection contre la perte de l'appareil ; prérequis du devis et du multi-appareil. |
| 6 | Lot D — Données entre onglets, calcul bloqué | moyen | M | Pertes silencieuses rares mais graves. |
| 7 | Lot F — Lire une pose | moyen | S à M | Compréhension des chiffres ; peu risqué. |
| 8 | Lot H — Accessibilité et chargement | moyen | S à M | Objectif Lighthouse ≥ 90 de `docs/PLAN.md` P5 sur téléphone. |
| 9 | Relevé rapide sur place | fort | M | Répond à PLAN-01 et PLAN-03 par le geste naturel du métier. |
| 10 | Aide et prise en main | moyen | S à M | Termes métier, premier contact. |
| 11 | Lot G — Éditeurs alignés | moyen | L | Promesse de N4 (même coquille). |
| 12 | Devis client | fort | M à L | Grande valeur, mais après des achats justes (lot C). |
| 13 | Fiche chantier par pièce, photos | moyen | M | |
| 14 | Doublages et plafonds, ragréage | moyen à fort | L / S à M | Nouveaux métiers, après la consolidation. |
| 15 | Lot I — Documents | faible | S | À faire au fil des lots. |

Ordre de réalisation proposé : **A → C → B → E → export/import → D → F → H → relevé rapide → aide → G → devis → fiche
chantier et photos → doublages / plafonds / ragréage**, une phase par branche comme le prévoit `docs/PLAN.md`, chaque
lot avec ses tests (unitaires et e2e 390 px + ordinateur) et la parité carrelage verte.

À toi de choisir les lots et fonctions à retenir ; rien n'est engagé.
