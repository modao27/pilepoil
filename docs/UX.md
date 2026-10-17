# Interface

## Principes
- Le plan est l'écran principal. Toucher un élément ouvre ses réglages (carreau, zone, ouverture, angle).
- Divulgation progressive : réglages courants visibles, avancés repliés.
- Chaque action est annulable. Les déplacements s'aimantent aux joints et aux bords.
- Les alertes disent quoi corriger et proposent l'action (« 3 coupes fines en bas — Optimiser »).
- Les nombres s'affichent avec leur unité ; champs avec +/−, calcul accepté (« 240-12 »).

## Navigation
```
Accueil (projets)
 └─ Projet
     ├─ Vue 3D (maquette de toutes les pièces, murs pleins / bas / coupés)
     ├─ Pièce (vue de dessus + 3D)            ← si pièce complète
     ├─ Surface (éditeur)                      ← écran principal
     ├─ Résultats (commande, découpe, achats, encollage)
     └─ Comparer (scénarios A/B)
Bibliothèque de carreaux (globale)
Réglages (unités d'affichage, thème, données, à propos)
```
Routage par hash (`#/p/:id/s/:surfaceId`), bouton retour du téléphone respecté.

## Écrans
**Projet** (`#/p/:id`, depuis S2) : vignette du plan (toucher : éditeur de plan), une carte par outil activé
avec son résumé (« 44 carreaux, 7,92 m² ») et ses alertes, « Ajouter un outil » pour les autres modules.

**Plan** (`#/p/:id/plan`) : plan d'ensemble en SVG, mêmes gestes que l'éditeur de surface (pincer, glisser,
toucher = sélection, panneau tiré à 3 crans ; inspecteur à droite sur ordinateur). Pièce choisie : poignées
sur les coins (glisser, aimantation grille 1 cm et angles droits), « + » au milieu des murs (ajouter un
point), cote de chaque mur (toucher : régler le mur). Ajout rapide : rectangle, L, U (cotes) ou dessin libre
point par point (fermer sur le premier point). Ouvertures glissées le long de leur mur ; « Relier à une autre
porte » place la seconde pièce pour que les portes se fassent face. Le panneau permet tout sans pointeur
(listes des pièces, murs, ouvertures, obstacles, portes à relier) ; problèmes listés en « À corriger ».

**Accueil** : cartes projet (vignette 3D, nom, date, m², coût). Bouton « Nouveau projet ». Vide : invitation à créer.

**Assistant** (4 étapes, aperçu en direct à chaque étape) : type (mur, sol, pièce) → dimensions →
carreau (bibliothèque ou nouveau) → motif. « Créer » ouvre l'éditeur.

**Éditeur de surface — téléphone**
```
┌──────────────────────────────┐
│ ← Mur A ▾        ↶ ↷  ⋯      │  barre haute : surface, annuler/rétablir, menu
│                              │
│        PLAN (plein écran)    │  pincer/zoomer, glisser le motif, toucher = sélection
│                              │
│  [Plan|Rendu|3D]   [Optimiser]│  outils flottants
├──────────────────────────────┤
│ 46 carreaux, 0 coupe fine, 312 €│  résumé permanent (toucher = Résultats)
├──────────────────────────────┤
│ Carreau Motif Zones Ouvert. Fin.│  panneau tiré : fermé / mi-hauteur / plein
│ …réglages de l'onglet ou de l'élément sélectionné… │
└──────────────────────────────┘
```
**Éditeur — ordinateur** : outils à gauche, plan au centre, inspecteur à droite, résumé en bas.

**Onglets du panneau**
- Carreau : choix dans la bibliothèque, couleur/photo, mélange, joint.
- Motif : grille d'icônes, orientation, départ, décalage, optimisation.
- Zones : liste réordonnable, taille (rangées/cm/reste), modèle frise.
- Ouvertures : ajout par type, liste, tableaux.
- Finitions : angles du mur, bords cachés, plinthes, réglages avancés (chutes, kerf, sens).

**Résultats** : onglets Commande, Découpe (liste par carreau numéroté), Achats (prix modifiables, total),
Encollage. Export PDF et partage.

**Pièce** : plan de dessus avec les 4 murs dépliés autour du sol, chaque surface cliquable ; 3D maquette.

**Bibliothèques** (`#/library/<id>`) : modèles types génériques et références relevées en magasin (`lm-…`), à
dupliquer et ajuster. Formulaire d'un produit : « Coller une fiche produit » en tête ; le tableau des
caractéristiques copié sur le site d'un magasin remplit les champs, un bandeau dit lesquels, rien n'est enregistré
sans validation. Le favori « Envoyer à PilePoil » (à installer depuis Réglages) fait la même chose depuis la page
du produit : `#/import` propose la bibliothèque devinée, puis ouvre le formulaire pré-rempli.

## Système de design
Identité PilePoil 1.0 (« Vos travaux, au millimètre près. »), adoptée le 2026-10-12 : voir `docs/IDENTITE.md`
et la référence `src/ui/design/identite/` (ne pas modifier). Variables dans `src/ui/design/tokens.css`,
couleurs hors CSS (PDF, 3D, canvas) dans `src/ui/brand.ts`.

Ivoire, pétrole pour l'action et la sélection, terracotta et ocre en aplats et repères. Une seule audace :
le plan coté. Le reste reste sobre.
```
--color-bg        ivoire #FAF1E9          fond         (sombre #182121)
--color-surface   #FFFFFF                 plan, cartes (sombre charbon #252D2D)
--color-text      charbon #252D2D         texte        (sombre ivoire)
--color-text-muted #5C6666                texte secondaire, jamais sur sauge (4,49:1) ; sélection : --color-selected-bg
--color-border    #C9D3CE                 séparateurs seulement ; champs : --color-field-border (≥ 3:1)
--color-primary   pétrole #174F50         action, sélection (sombre #6FB0AB)
--color-accent    terracotta #D17A59      aplats, jamais en texte → --color-accent-text #A4502F
--color-highlight ocre #C7A45A            repères, badges, jamais en texte → --pp-ocre-texte #7E6020
--status-cut      ocre                    coupé
--status-reuse    #7CC4A0                 taillé dans une chute
--status-thin     terracotta              coupe fine / apparente ; erreur en texte : --color-error
```
Typo : Manrope (titres, chiffres clés), Inter (interface, cotes en `tabular-nums`). Échelle 11/12/14/16/20/24/32.
Champs de saisie en 16 px minimum (sinon Safari iOS zoome au focus ; le jeton `--text-input` est en px, car 1 rem
vaut 14 px ici ; `expectInputFonts` le vérifie dans les e2e). Contraste AA vérifié par
`tests/unit/contrast.test.ts`, en clair et en sombre.
Rayons : 8 px (champs, boutons), 12 px (panneaux). Pas d'ombres décoratives ; élévation seulement pour
le panneau tiré et les menus. Icônes 24 × 24 en trait 1,75 (`src/ui/icons.ts`), icônes de module 34 × 24.
Logo horizontal dans la coquille (couleur en clair, mono blanc en sombre) et en en-tête des PDF.

Saisie des nombres (`NumberField`, `ui/lib/calc.ts`) : calcul simple et unités de longueur (« 2,4 m », « 240 cm »,
« 1 m + 20 cm »), converties dans l'unité du champ ; un nombre sans unité reste dans celle du champ. Une saisie
incompréhensible garde l'ancienne valeur et le dit ; une valeur hors bornes est ramenée à la borne avec la raison ;
`soft` signale sans refuser une valeur inhabituelle (mur < 20 cm ou > 30 m, hauteur > 6 m).

Composants : Button, IconButton, Segmented, NumberField (unité, +/−, calcul), ColorSwatch, PhotoPicker
(fichier + coller + glisser, message d'état), BottomSheet (3 crans, clavier accessible), Tabs, ListReorder,
Toast (annuler), Dialog, EmptyState, StatCard, DataTable (scroll horizontal sur mobile).

## Textes
Sentence case, verbes d'action (« Ajouter une fenêtre », « Optimiser le départ »), même mot du bouton
au message de confirmation. Erreurs : ce qui ne va pas + comment corriger, sans excuse.
