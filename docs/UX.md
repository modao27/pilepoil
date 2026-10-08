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

## Système de design
Ambiance « plan de chantier » : papier bleu-gris, encre, bleu de cobalt pour l'action, jaune/vert/rouge
réservés aux statuts de coupe. Une seule audace : le plan coté. Le reste reste sobre.
```
--paper   #E6EBEE   fond        (sombre #0E161B)
--sheet   #FFFFFF   plan        (sombre #1A262E)
--ink     #15232C   texte       (sombre #E4EBEF)
--muted   #5A6A74
--line    #CDD5DA
--accent  #2747C9   action, sélection (sombre #8299FF)
--cut     #F0BE45   coupé
--reuse   #7CC79A   taillé dans une chute
--thin    #D9472B   coupe fine / apparente / erreur
```
Typo : Barlow (interface), Barlow Condensed (cotes, chiffres clés). Échelle 12/14/16/20/28.
Rayons : 8 px (champs, boutons), 12 px (panneaux). Pas d'ombres décoratives ; élévation seulement pour
le panneau tiré et les menus. Icônes de motifs en trait fin.

Composants : Button, IconButton, Segmented, NumberField (unité, +/−, calcul), ColorSwatch, PhotoPicker
(fichier + coller + glisser, message d'état), BottomSheet (3 crans, clavier accessible), Tabs, ListReorder,
Toast (annuler), Dialog, EmptyState, StatCard, DataTable (scroll horizontal sur mobile).

## Textes
Sentence case, verbes d'action (« Ajouter une fenêtre », « Optimiser le départ »), même mot du bouton
au message de confirmation. Erreurs : ce qui ne va pas + comment corriger, sans excuse.
