# Audit UI/UX de PilePoil — rapport

Audit des 16 et 17 octobre 2026 (matrice complète : 89 scénarios × 29 appareils), branche `audit/ui-ux`, sur `main` 1cd0bc6 (phases jusqu'à B2). Aucun fichier de `src/` n'a
été modifié. Détails : [`CONSTATS.md`](CONSTATS.md) et [`constats.csv`](constats.csv) ; couverture :
[`MATRICE.md`](MATRICE.md) ; cartographie : [`CARTOGRAPHIE.md`](CARTOGRAPHIE.md) ; à vérifier sur un vrai téléphone :
[`A_TESTER_SUR_TELEPHONE.md`](A_TESTER_SUR_TELEPHONE.md) ; propositions : [`PROPOSITIONS.md`](PROPOSITIONS.md).

## Synthèse

PilePoil tient ses promesses de fond : les quatre outils calculent juste sur les cas vérifiés à la main (carrelage,
parquet, peinture, cloisons, voir § Justesse métier), vite (0,1 à 0,25 s même sur 120 m²), hors ligne, et l'interface est
très propre en accessibilité automatique (axe-core : aucune violation sur les 33 écrans en clair et en sombre ; seules
remontent, sur les 29 appareils, des cibles trop rapprochées en paysage et deux cas de données forcées). Les défauts se concentrent sur **la gestion des projets**, **la précision du plan au
doigt** et **la liste d'achat**, c'est-à-dire là où l'artisan engage du temps ou de l'argent.

**Les 5 problèmes les plus graves**

| # | ID | Problème | Gravité |
|---|---|---|---|
| 1 | PRJ-01 | Un projet sans carrelage ne peut être ni renommé depuis l'accueil, ni dupliqué, ni supprimé : aucun menu, aucun autre écran. | P1 |
| 2 | ACH-01 | Rails et montants des cloisons sans quantité dans la liste d'achat (écran et PDF) ; le CSV seul la donne. | P1 |
| 3 | PLAN-01 | Glisser un coin de pièce l'emmène 2 à 3 fois plus loin que le doigt : la pièce se déforme (12 → 25 m²). | P1 |
| 4 | CAR-01 | En vannerie, les achats inventent un carreau « 20 × 9,9 cm » sans prix : total sous-estimé de 30 %. | P1 |
| 5 | PLAN-02 / ROB-01 | Pertes silencieuses : Suppr efface une pièce revêtue sans confirmation ; deux onglets s'écrasent l'un l'autre. | P1 |

**Constats** : 51 au total — P0 : 0, P1 : 6, P2 : 25, P3 : 20 (liste vivante : `tests/audit/constats.ts`).
Aucun calcul faux n'a été trouvé dans les moteurs ; les écarts chiffrés viennent de la présentation (achats, libellés).

**Notes par axe** (sur 10, appréciation de l'auditeur à partir des constats)

| Axe | Note | En bref |
|---|---|---|
| UX (parcours, navigation) | 6 | Parcours projet → pièce → pose clair et cohérent ; gestion des projets incomplète, écran Comparer orphelin, aucune aide. |
| UI (identité, cohérence) | 7 | Identité bien appliquée (pétrole, ivoire, Manrope/Inter, sombre soigné) ; parquet et carrelage n'ont pas les mêmes outils ; champs en 14 px. |
| Accessibilité | 8 | axe-core propre, focus visibles, cibles ≥ 44 px, mouvement réduit respecté ; titres de page absents, obstacle non réglable au clavier, débordement à 200 %. |
| Performance | 7 | Calculs rapides, ordinateur 94–100 ; téléphone : accueil 75, vue globale 72, résultats 80 (Lighthouse). |
| Textes | 7 | Français simple et poli ; termes métier non expliqués, « pose n » numérotées, « perte » à deux sens, messages d'erreur parfois faux. |
| Justesse métier | 7 | Moteurs justes sur tous les cas vérifiés ; achats : produit inventé (vannerie), quantités absentes (cloisons), lames A/B d'un stratifié. |
| Robustesse | 6 | Hors ligne, stockage plein et mise à jour bien gérés ; deux onglets, raccourci Suppr, calcul bloqué sans message, suppression de projet non écrite. |

## Méthode

- Lecture du code et des documents (`CLAUDE.md`, `docs/*`, `PilePoil_instructions_Claude_Code.md`), cartographie des
  20 routes et 8 écrans de modules (`CARTOGRAPHIE.md`).
- 89 scénarios Playwright (`tests/audit/*.spec.ts`, `npm run test:audit`), sur 29 projets d'appareils : téléphones
  360 à 430 px portrait et paysage (Chromium et WebKit), tablettes 768 et 1024 (WebKit), ordinateurs 1280 à 1920
  (Chromium, Firefox, WebKit). Les scénarios ne s'arrêtent pas sur un constat : ils le relèvent
  (`docs/audit/captures-local/mesures/`, agrégés dans `docs/audit/mesures/`).
- Jeu de données « maison » créé par le parcours normal (`tests/audit/fixtures.setup.ts`) : séjour 6 × 4 m coupé par une
  cloison, salle de bain en L, parquet au sol, crédence carrelée, peinture au-dessus et sur un mur, sol et murs carrelés
  dans la salle de bain, un prix saisi.
- Contrôles automatiques à chaque écran : axe-core (WCAG 2.2 A/AA), cibles < 44 px, défilement horizontal, champs
  < 16 px ; Lighthouse sur 10 écrans (appareils Chromium) ; PDF et CSV ouverts et lus (pdfjs).
- Captures regardées une à une par l'auditeur (référence : téléphone 390 × 844 Chromium et ordinateur 1280 × 800
  Chromium, `docs/audit/captures/<écran>/<appareil>/`).

## Justesse métier : calculs refaits à la main

**Carrelage, sol 300 × 240 cm, grès 60 × 60, joint 3 mm** (scénario E7)
- Colonnes : 4 carreaux entiers + joints = 4 × 603 = 2 412 mm ; reste 3 000 − 2 412 = 588 mm → coupe de 588 mm ✓
  (« n° 5 : 588 × 600 »).
- Rangées : 3 × 603 = 1 809 mm ; reste 2 400 − 1 809 = 591 mm → coupe de 591 mm ✓ (« n° 1 : 600 × 591 »).
- Positions : 5 × 4 = 20 « nécessaires » ✓ ; marge de casse 10 % → 22 ✓ ; carton de 1,08 m² = 3 carreaux →
  ⌈22 / 3⌉ = 8 cartons ✓ ; 22 × 0,36 = 7,92 m² ✓. Colle 59 kg en double encollage (≈ 8 kg/m² × 7,2 m²) : plausible.

**Parquet, séjour 2 928 × 4 000 mm, stratifié 1 285 × 192, jeu 8 mm** (F6)
- Longueur utile 4 000 − 16 = 3 984 mm ; rang 1 : 1 114 + 1 285 + 1 285 + 300 = 3 984 ✓.
- Largeur utile 2 928 − 16 = 2 912 mm = 14 rangs × 192 + 2 rangs de bord égaux de 112 mm (2 688 + 224) ✓.
- Lames entamées (fiche de coupe) : 16 + 16 + 16 + 4 = 52 ✓ ; + 5 % = 54,6 → 55 lames ; paquets de 9 → 7 ✓.
- Plinthes : périmètre 2 × (2,928 + 4) = 13,86 m − mur 1 carrelé depuis le sol (2,928 m) = 10,93 m ≈ « 10,9 m » ✓.

**Peinture, séjour mur 3 (2,928 × 2,50 m)** (G3, G4)
- Brut 7,32 m² ✓ ; plinthes 2,928 × 0,07 ≈ 0,2 m² ✓ ; net 7,1 m² ; 2 couches à 10 m²/L = 1,42 L ; marge 10 % → 1,6 L ✓
  → 1 pot de 2,5 L ✓.
- Au-dessus de la crédence (mur 1, 120 → 250 cm) : 2,928 × 1,30 = 3,81 m² ✓ ; 0,8 L ✓ ; les deux poses de la même
  peinture partagent un seul pot dans les achats ✓.

**Cloison, 400 × 250 cm, 72/48, entraxe 60** (H2, J4)
- Montants : 400 / 60 → 6 de trame + 2 de départ + 2 d'arrivée (doublés) = 10 ✓, longueur 249 cm ✓.
- Rails : 2 × 400 = 800 cm en barres de 3 m → 3 barres ✓ (dans le CSV seulement, ACH-01).
- Plaques 1 200 × 2 500 : 4 pièces par face (3 × 1 200 + 400 = 4 000 mm), la pièce de 400 taillée dans une chute,
  7 feuilles ✓ ; 2 faces × 4,00 × 2,49 = 19,92 m² posés ✓.

**Écarts relevés** : vannerie (CAR-01), lames A/B d'un stratifié (PAR-01), quantité absente (ACH-01), deux « pertes »
(PAR-03). Vérifié aussi : 1 171 carreaux de 0,02 m² = 23,42 m², soit 47 cartons de 0,5 m² (23,5 m²) pour 21,96 m²
carrelés, casse comprise ; total des achats = 23,5 m² × 24,90 € = 585,15 € ✓.

## Grilles d'analyse

### Heuristiques de Nielsen

✓ bon, ~ partiel, ✗ manque. Les identifiants renvoient aux constats.

| Heuristique | Accueil | Plan | Pièce | Calepinage | Résultats | Achats | Bibliothèques |
|---|---|---|---|---|---|---|---|
| 1. Visibilité de l'état | ~ chiffres du seul carrelage (PRJ-02) | ✓ mode affiché dans le panneau | ✓ zones colorées et nommées | ~ résumé du projet, pas de la pose (UX-01) | ✓ | ✓ total, articles sans prix | ✓ |
| 2. Correspondance avec le monde réel | ✓ | ~ cotes en cm implicites (PLAN-04) | ~ « Pose 3 » au lieu de « crédence » (UX-02) | ~ « coupe perdue », « bande » non expliqués | ~ deux « pertes » (PAR-03) | ✓ conditionnements réels | ✓ fiches magasin |
| 3. Contrôle et liberté | ✗ pas de suppression hors carrelage (PRJ-01) | ~ annuler, mais Suppr sans confirmation (PLAN-02), coin incontrôlable (PLAN-01) | ✓ annuler dans les toasts | ✓ annuler / rétablir | ✓ | ~ saisie invalide efface (ACH-02) | ✓ |
| 4. Cohérence et standards | ~ | ~ raccourcis absents (PLAN-08) | ✓ | ✗ parquet ≠ carrelage (UI-02) | ~ séparateurs, « PDF du calepinage » en peinture | ✓ | ✓ |
| 5. Prévention des erreurs | ~ suppression sans confirmation | ~ 2,4 = 2,4 cm (PLAN-04) | ~ découpe quittée au bord (PIE-01) | ~ carreau de mur au sol (CAR-03) | ✓ | ✗ produit inventé (CAR-01) | ✓ produit utilisé protégé |
| 6. Reconnaître plutôt que se souvenir | ~ pas de vignette du plan | ✓ listes et dessin | ✓ | ~ 28 carreaux sans recherche (CAR-02) | ✓ | ✓ | ~ pas de recherche |
| 7. Flexibilité et efficacité | ✗ ni recherche ni tri | ~ pas de clavier | ✓ | ✓ raccourcis carrelage | ✓ | ✓ CSV | ✓ fiche collée |
| 8. Esthétique et minimalisme | ✓ | ✓ | ✓ | ✓ | ✓ | ~ liste très longue sur téléphone | ✓ |
| 9. Aider à corriger les erreurs | ✓ | ~ messages faux (PLAN-06) | ~ toast répété (PIE-03) | ✓ alertes avec action (parquet) | ✓ Réessayer | ~ | ✓ |
| 10. Aide et documentation | ✗ (AIDE-01) | ~ consignes du dessin | ✓ consigne courte | ~ | ~ | ✓ note sur les arrondis | ✓ |

### Conformité à `docs/UX.md` et à l'identité

- Couleurs, typographie, rayons, icônes de module, logo en clair et en sombre : conformes ; le mode sombre est soigné
  (captures `*/N1-dark.jpg`).
- Écarts : champs < 16 px (UI-01) ; « champs avec +/− » respecté pour NumberField seulement ; carte d'accueil (« vignette
  3D, m², coût ») seulement pour le carrelage ; éditeur parquet sans outils de vue (UI-02) ; titres d'étape h2 dans le
  parquet et la peinture, h3 dans le carrelage ; `docs/UX.md` lui-même décrit l'ancienne application (DOC-01).

### Accessibilité (WCAG 2.2 AA)

- axe-core : 0 violation sur les 33 écrans du tour, en clair et en sombre, sur les 29 appareils (détail :
  `mesures/controles.md`), sauf `target-size` sur « Voir tout le plan » en paysage (7 appareils) et sur « Optimiser » à 200 %
  (A11Y-03), et `link-name` pour des noms de projet vides forcés dans les données (non atteignable par l'interface).
- Contraste : vérifié par axe (et par `tests/unit/contrast.test.ts` du projet) ; terracotta et ocre jamais en texte.
- Cibles : ≥ 44 px partout sauf deux murs dépliés étroits de l'écran Pièce (41 × 103, 103 × 33 px) et le lien de
  cloison des résultats (21 px de haut).
- Clavier : ordre logique, pas de piège, focus visible (trait épais sur le dessin SVG) ; manque : obstacle (PLAN-05).
- Titres de page et h1 des éditeurs : A11Y-01. Zoom 200 % : A11Y-02 et UI-04 (débordement bien plus fort sous WebKit). Mouvement réduit : respecté (aucune transition
  restante).
- Alternatives au dessin : le dessin de la pièce a une liste équivalente ; le plan a ses listes de pièces, murs et
  ouvertures ; l'élévation des cloisons a une description ; le calepinage n'a que la fiche de coupe dans les résultats.

### Ergonomie mobile

- Zone du pouce : actions principales en bas (résumé, panneau tiré), annuler / rétablir en haut à droite (loin du pouce
  gauche).
- Safe areas : `viewport-fit=cover` et `env(safe-area-inset-top)` dans le plan ; à vérifier sur iPhone à encoche.
- `100dvh` utilisé (pas de 100vh) ; panneau tiré à trois crans fonctionnel au doigt et au clavier.
- Gestes : pincer, glisser, toucher ; conflits : PLAN-01 (coin), PLAN-03 (fermer le dessin), PIE-01 (découpe).
- Plein soleil : contraste suffisant en clair ; grille du plan très pâle (à vérifier dehors).

### Textes

Phrases courtes, verbes d'action, vouvoiement constant, vocabulaire du métier juste (calepinage, coupe fine, chute,
rang de bord, entraxe, rail, montant). À reprendre : messages faux ou répétés (PLAN-06, PIE-03), « pose n » (UX-02),
« perte » (PAR-03), À propos limité au carrelage, aucune explication des termes (AIDE-01).

### Parcours (taps sur téléphone, saisies non comptées)

| Tâche | Taps | Remarques |
|---|---|---|
| Créer un projet avec une pièce rectangulaire | 2 | Nouveau projet → Ajouter (valeurs proposées 400 × 300). |
| De là, carreler le sol et voir le calepinage | 5 | Retour projet → pièce → Sol → Revêtir : carrelage → Calepinage. Le plan propose aussi « Choisir les revêtements ». |
| Changer de carreau | 3 + défilement | Ouvrir le panneau → Produit → défiler parmi 28 carreaux. |
| Voir la liste d'achat depuis le calepinage | 2 | Résumé → Achats. |
| Exporter le PDF de la pose | 2 | Résumé → PDF du calepinage. |
| Supprimer un projet parquet seul | impossible | PRJ-01. |
| Comparer deux réglages | impossible sans l'adresse | UX-03. |

Culs-de-sac : lien « Importez vos données » (UX-04), « Annuler » de Nouveau projet (NOU-01), écran Comparer (UX-03).
Retour navigateur : remonte d'un niveau partout (résultats → calepinage → pièce → projet → accueil).
Pertes de données possibles : ROB-01, PLAN-02, PRJ-03, PLAN-07.

## Performance

| Mesure | Téléphone 390 (émulé) | Ordinateur 1280 |
|---|---|---|
| Recalcul d'un motif (maison, parquet) | 0,10 à 0,15 s | 0,09 à 0,14 s |
| Premier calcul, parquet 120 m² | 0,26 s | 0,24 s |
| Point de Hongrie / bâton rompu 120 m² | 0,11 / 0,23 s | 0,11 / 0,24 s |
| Tâches longues pendant un recalcul | 0 | 0 |
| Lighthouse performance (accueil, projet, plan, pièce, calepinage, parquet, résultats, achats, bibliothèque, réglages) | 75, 72, 91, 99, 95, 96, 80, 100, 100, 98 | 100, 97, 100, 100, 100, 100, 94, 100, 100, 100 |
| Lighthouse accessibilité, bonnes pratiques, SEO | 100 partout | 100 partout |
| 3G lent + processeur ×4 : accueil / nouveau projet / vue globale | 7,9 s / 2,6 s / 1,6 s | — |
| 3D projet : i/s au repos / en tournant | 60 / 24 | 60 / 44 |
| Fichiers précachés | 2,6 Mo, 195 fichiers (jsPDF 390 Ko, scène 372 Ko, html2canvas 195 Ko) | |

Toutes les mesures par appareil : `mesures/performance.md`. L'émulation ne remplace pas un vrai téléphone (rendu 3D
logiciel, processeur du PC) : voir `A_TESTER_SUR_TELEPHONE.md`.

## Couverture et limites

Voir [`MATRICE.md`](MATRICE.md) : 2 440 exécutions sur 2 581 au bout sans étape en échec, 36 sans objet, le reste
expliqué cellule par cellule. Non testé : installation réelle, iOS réel (zoom au focus, encoche, clavier), plein soleil,
gants, appareil photo, hors ligne sous WebKit, multi-touch WebKit, Lighthouse hors Chromium.
