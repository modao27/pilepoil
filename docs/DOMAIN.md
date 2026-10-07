# Règles métier

Toutes les valeurs sont en mm sauf mention contraire. Implémentation de référence : `legacy/calepinage.html`
(fonctions citées entre parenthèses).

## Modèle de données
```
Project      { id, name, updatedAt, room?: Room, surfaces: Surface[], settings: Settings, prices: Record<key, number> }
Room         { length, width, height, tiledHeight, walls: { A?, B?, C?, D?, floor? : surfaceId } }
Surface      { id, name, kind: 'wall'|'floor', width, height, joint, split: 'h'|'v',
               zones: Zone[], openings: Opening[], corners: Corner[], plinth?: Plinth,
               hiddenEdges: {top,bottom,left,right}, junctionsCovered: boolean }
Zone         { id, size, unit: 'rows'|'cm'|'rest', tileId, pattern, angle, start: 'corner'|'tile'|'joint',
               offsetX, offsetY, mix: 'solid'|'alternate'|'random', colorB?, groutColor, photoRandomFlip }
Tile (bibliothèque) { id, name, length, width, thickness, color, photoId?, m2PerBox, pricePerM2?, orientation: 'free'|'180'|'none' }
Opening      { id, type: 'window'|'door'|'socket'|'trap'|'tub'|'other', x, sill, width, height,
               covered, revealDepth, reveals: {L,R,T,B}, projection? }
Corner       { id, x, type: 'in'|'out', angle, covered }
Plinth       { length, height, zoneId }
Settings     { margin%, reuseOffcuts, kerf, minOffcut, shadeVariation, optimizerGoal }
```
Nouveauté par rapport à legacy : la **bibliothèque de carreaux**. Une zone référence un `tileId`
au lieu de porter dimensions, couleur, carton et prix.

## Motifs (`gen`, `geo`)
Chaque motif génère des **cellules sans joint** (polygones convexes) dans un repère local, puis chaque cellule
est rétractée de joint/2 (`inset`) pour obtenir le carreau. Cellule = carreau + joint.
- Droit, décalé ½, ⅓, ¼, décalé aléatoire (décalage par rangée 20–80 % via hash déterministe)
- Bâtons rompus : réseau v1=(B,B), v2=(A,−A), cellule H à la base, V à base+(A, B−A) ; A=long+j, B=court+j
- Point de Hongrie : parallélogrammes, w=(long+j)/√2, h=(court+j)·√2, colonnes gauche/droite (miroirs = produits distincts)
- Vannerie : carré S=long+j, n=round(S/(court+j)) lames, largeur ramenée à S/n − j
- Hexagone (côté plat à côté plat = longueur), octogone + cabochon (cabochon côté = s − j, s = S/(1+√2))
Points de départ (`tl`, `ctr`, `jn` par motif) : angle de zone, centré sur carreau, centré sur joint. Rotation 0/30/45/60/90°.
Décalage X/Y appliqué à l'origine.

## Construction des pièces (`buildZone`)
1. Carreau → repère zone, découpe par le rectangle de zone (Sutherland-Hodgman).
2. Soustraction des ouvertures (sauf prises) : découpage en 4 régions convexes autour du rectangle.
   Plusieurs parties d'un même carreau = une seule pièce « encoche ». Les coutures internes ne sont pas des bords.
3. Découpe aux angles de mur : un carreau à cheval devient deux pièces séparées.
4. Prise : pas de soustraction, la pièce est marquée « perçage ».
5. Classement : entière si aire ≥ 99,9 % ; coupe fine si plus petite dimension < max(20 mm, ¼ du petit côté) ou aire < 8 %.
6. Repère carreau canonique (long côté horizontal) pour les coupes et le réemploi.

## Bords d'usine et coupes apparentes
- Chaque arête de pièce en contact avec un carreau voisin (pas sur un bord de zone, une ouverture ou un angle)
  exige un **bord d'usine** du côté correspondant du carreau (`req` L/R/T/B).
- Une arête coupée sur un bord **visible** est une **coupe apparente** : bords de surface non cachés,
  jonctions de zones non recouvertes, ouvertures non recouvertes, angles sortants sans profilé.
- Face émaillée : jamais de retournement (miroir). Rotations permises selon le sens du carreau :
  libre (0/90/180/270), demi-tour seulement, aucune.

## Réemploi des chutes (`planCuts`)
- Regroupement par produit (forme, dimensions, couleur) sur **tout le projet** (chutes partagées entre surfaces).
- Ordre des pièces : surfaces dans l'ordre du projet, quelle que soit la surface affichée. *Évolution décidée
  (2026-10-07)* : legacy plaçait la surface active en premier, ce qui pouvait renuméroter les carreaux, voire
  changer la commande, en changeant de surface. Parité vérifiée avec surface active = 0.
- Pièces triées par aire décroissante ; chaque pièce va dans la plus petite chute compatible, sinon un nouveau carreau.
- Chutes rectangulaires avec bords d'usine mémorisés ; découpe guillotine (deux options, on garde la meilleure aire,
  bonus pour les bords d'usine conservés). Perte par coupe (kerf) et chute minimale gardée paramétrables.
- Coupe biaise à une seule coupe droite : la chute est le complément polygonal (bords d'usine implicites).
- Formes non rectangulaires (hexagone, octogone, Hongrie) : complément polygonal et rotations de symétrie.
- Placement d'une pièce : ses côtés `req` doivent tomber sur des bords d'usine de la chute.

## Optimisation du départ (`optimize`)
Grille sur une période du motif puis affinage autour du meilleur. Objectifs :
coupes fines/apparentes, nombre de carreaux, équilibré, symétrique (centré carreau/joint).
Zones en rangées : axe verrouillé. Score = combinaison pondérée (voir `scoreOf`).

## Quantités
- Nécessaires = entiers + carreaux entamés pour les coupes. À commander = ceil(nécessaires × (1 + marge)).
- Cartons = ceil(m² à commander / m² par carton).
- Tableaux de fenêtre/porte : bandes profondeur × longueur, bords d'usine sur l'arête avant si non recouverte.
- Plinthes : segments de longueur carreau, bord d'usine en haut.

## Encollage (`glueAdvice`) — indicatif, pose intérieure
| S (cm²) | Spatule | Mur | Sol |
|---|---|---|---|
| ≤ 50 | U3 | simple | simple |
| ≤ 500 | U6 | simple | simple |
| ≤ 1100 | U9 | double | simple |
| ≤ 2200 | U9 | double | double |
| ≤ 3600 | U9 (sol : U9 ou DL20) | double, C2 S1 | double, C2 S1 |
| > 3600 | DL20 | hors DTU | double, C2 S1 ; hors DTU > 10 000 |
Format allongé (rapport ≥ 3 et long ≥ 600 mm) : double encollage recommandé.
Consommation : U3 2, U6 3, U9 4,5, DL20 7,5 kg/m² ; +1,5 kg/m² en double encollage.

## Consommables (`shoppingItems`)
- Joint (kg/m²) = (L + l)/(L × l) × épaisseur × largeur joint × 1,6 (mm), sacs de 5 kg, par couleur.
- Colle : sacs de 25 kg. Croisillons ≈ 1,3 par carreau (< 450 mm), cales ≈ 3 par carreau (≥ 450 mm).
- Primaire 0,15 L/m². Profilés : arêtes recouvertes, barres de 2,5 m. Silicone : angles rentrants, menuiseries,
  baignoire, périmètre sol/murs ; 10 m par cartouche.

## Invariants à tester
- Joint 0 : somme des aires des pièces = aire des zones − ouvertures (écart < 0,1 %), sur tous motifs/angles/départs.
- Aucun point couvert par deux pièces ; aucun point d'ouverture couvert.
- Toute pièce rectangulaire tient dans le carreau ; somme des pièces d'un carreau ≤ aire du carreau.
- À commander ≥ nécessaires ≥ 1 ; aucune exception sur les cas limites listés dans `tests/` (surface nulle,
  joint négatif, trop de carreaux, zones qui débordent, ouverture hors surface, angle hors surface, etc.).
