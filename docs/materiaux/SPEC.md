# Matériaux et techniques de pose (N6) — spécification

Statut : **brouillon à valider**, aucun code. Décidé le 2026-10-17 : bibliothèque d'environ 20 modèles, chacun
avec une technique de pose rattachée ; briques de verre incluses (transparentes, colorées, texturées). Les murets
multi-matériaux viennent après (phase suivante).

## Légende de fiabilité
- **S** : valeur lue dans une source citée (fiche fabricant), extraction à recouper avec l'original.
- **C** : à confirmer. Valeur de métier courante, non sourcée par la recherche du 2026-10-17.
- Le texte du NF DTU 20.1 n'a pas pu être consulté (payant) : aucune règle n'est donnée comme « conforme DTU ».

## Modèle
- `Material` : `id`, `name`, `family` (`parpaing`, `brique`, `beton-cellulaire`, `carreau-platre`, `plaque`,
  `pave-verre`), `size` (longueur, hauteur, épaisseur en mm), `weight?` (kg), `price?`, `laying` (technique).
- `LayingTechnique` : `jointHorizontal` (mm, min/défaut/max), `jointVertical` (mm ou `dry`), `bond`
  (`running` : à demi-longueur, `stack` : joints alignés), `minOverlap` (mm, recouvrement mini des joints
  verticaux), `binder` (`mortier`, `mortier-semi-epais`, `joint-mince`, `colle`, `mortier-colle`),
  `binderPerM2` (kg/m², selon `binder`), `cutAllowed` (booléen), `reinforcement?` (armature, voir verre).
- Stockage : magasin IndexedDB `materials`, bibliothèque `#/library/materials`, modèles types posés une fois.
- Unités internes en millimètres ; kg et prix hors géométrie.

## Techniques de pose (règles)
| Technique | Joint H | Joint V | Appareillage | Liant (kg/m²) | Fiabilité |
|---|---|---|---|---|---|
| Parpaing, mortier traditionnel | 10–15 mm | sec (sauf zone sismique) | à demi-longueur | 35–40 (joints pleins), 25–30 (3 boudins), pour 20 cm | S |
| Mortier semi-épais (joints vifs) | ≈ 10 mm écrasé | sec | à demi-longueur | 15–20 | S |
| Joint mince (blocs calibrés) | 1–3 mm | sec | à demi-longueur | 0,8–2 (25 cm d'épaisseur) | S |
| Brique de verre | 10–30 mm | 10–30 mm (même valeur) | **joints alignés**, jamais décalés | mortier armé | S |

## Briques de verre
Source : documentation La Roche, [fiche BigMat](https://medias.bigmat.fr/data_medias/medias_finaux/documents/3232879806224-U0sYqJfqT1.pdf).
- Joints de 10 à 30 mm (S). Bordures périphériques de 40 à 100 mm (S).
- Armature : fers de 4,5 à 6 mm, 1 à 2 fers par rang horizontal et vertical selon la surface du panneau, 1 à 3 fers
  dans les bordures ; jamais au contact du verre, à plus de 15 mm de l'extérieur (S).
- Surface max. d'un panneau, selon l'épaisseur : ≈ 3 m² (5 cm), ≈ 30 m² (8 cm), ≈ 40 m² (10 cm), petit côté ≤ 3 à
  3,5 m (S, tableau mal extrait : **à recouper avant usage**).
- Formats 19×19, 24×24, 30×30 cm, épaisseur 8 cm usuelle (C). Variantes : transparent, coloré, texturé (même
  technique, seul le nom et le prix changent).
- Le verre ne se coupe pas : la largeur et la hauteur d'un panneau sont des multiples entiers de brique + joints.
  Alerte `glass-not-cuttable` si l'ouverture n'est pas un multiple ; le moteur propose la taille de panneau la plus
  proche et la bordure à absorber.
- Un panneau de pavés dans un mur de parpaings est le cas d'usage de la phase « murets multi-matériaux ».

## Liste des modèles (cible ≈ 20, valeurs C sauf mention)
1. Parpaing creux 20×20×50, 15×20×50, 10×20×50, 7,5×20×50 (4 modèles)
2. Parpaing plein 20×20×50, 10×20×50 (2)
3. Brique creuse 5×20×40 (cloison) et brique de cloison 7×… (2, formats à fixer sur fiche fabricant)
4. Brique alvéolaire / monomur, 20 et 30 cm (2)
5. Béton cellulaire 60×25 en 7,5 / 10 / 15 / 20 cm, joint mince (4)
6. Carreau de plâtre 66,6×50, 5 à 10 cm, pose à la colle (3)
7. Brique de verre 19×19×8, 24×24×8, 30×30×10 + variantes coloré et texturé (≥ 3 modèles de base)

Les formats exacts, poids et consommations sont à relever sur les fiches fabricants avant implémentation. La plaque
de plâtre sur ossature reste couverte par le module cloisons, pas par cette bibliothèque.

## Alertes du moteur (codes, texte dans l'UI)
`glass-not-cuttable`, `overlap-below-min` (appareillage), `panel-area-exceeds-max` (verre), `joint-out-of-range`.

## Invariants à tester (fast-check)
- Le nombre d'éléments × leur surface + joints couvre la surface demandée, sans la dépasser de plus d'un élément.
- Pour le verre : largeur de panneau = n × brique + (n − 1) × joint + 2 × bordure, n entier.
- Consommation de liant monotone avec la surface ; jamais négative.
- Ordre des éléments sans effet sur le total.

## Étapes et critères de fin
Reprendre le plan de `docs/PLAN.md` (à ajouter après validation de cette spec) : modèle et stockage, moteur,
interface, achats. Fini quand `npm run check`, la parité carrelage et les e2e sont verts.

## Décisions du 2026-10-17
- Pas d'extrait du DTU disponible : toutes les valeurs sont affichées « à titre indicatif (estimation) » dans
  l'interface ; la fiabilité S / C de cette spec sert de base à ce libellé.
- Prix saisis dans le projet (comme les cloisons), pas de prix préremplis dans la bibliothèque.
- La plaque de plâtre reste hors de cette bibliothèque (module cloisons).
- Reste à faire : relever les formats exacts, poids et consommations sur fiches fabricants avant implémentation.
