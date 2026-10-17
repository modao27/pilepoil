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

## Moteur (fait en N6)
- Mur saisi par longueur × hauteur et matériau ; joint par défaut : valeur usuelle de la technique.
- Rangs : `ceil((H + j) / (h + j))` ; éléments par rang : `ceil((L + décalage + jv) / (l + jv))`, décalage d'une
  demi-longueur un rang sur deux (pose à demi-longueur) ; joints verticaux secs : `jv = 0`.
- Coupes : bouts des rangs décalés ou non multiples, et tout le dernier rang s'il est recoupé en hauteur.
- Briques de verre : le plus grand nombre de briques qui laisse 4 cm de bordure ; au-delà de 10 cm, alerte avec
  l'ouverture proposée. Fers : un par joint et un par bordure, dans les deux sens.
- Achats : éléments + marge (5 % par défaut), liant en sacs (25 kg par défaut), fers d'armature en mètres.

## Décisions du 2026-10-17
- Pas d'extrait du DTU disponible : toutes les valeurs sont affichées « à titre indicatif (estimation) » dans
  l'interface ; la fiabilité S / C de cette spec sert de base à ce libellé.
- Prix saisis dans le projet (comme les cloisons), pas de prix préremplis dans la bibliothèque.
- La plaque de plâtre reste hors de cette bibliothèque (module cloisons).
- Reste à faire : relever les formats exacts, poids et consommations sur fiches fabricants avant implémentation.

## Relevé fabricants (2026-10-17, indicatif)
Poids et consommations relevés par recherche web ; les cases « — » sont sans source trouvée (valeur à saisir par
l'utilisateur, pas de valeur inventée). Tout est affiché « à titre indicatif (estimation) ».

| Modèle | Dimensions (mm) | Poids | Liant | Source |
|---|---|---|---|---|
| Parpaing creux B40 20×20×50 | 500×200×200 (fabrication 491×195×190) | 17 kg | mortier 35–40 kg/m² | [Samse](https://medias.groupe-samse.fr/Fiche_technique/Fiche_technique_19568.pdf) |
| Parpaing creux B40 15×20×50 | 500×200×150 | 13,8 kg | idem | [Samse](https://medias.groupe-samse.fr/Fiche_technique/Fiche_technique_1339.pdf) (ligne à recouper) |
| Parpaing creux B40 10×20×50 | 500×200×100 | 9,9 kg | idem | idem |
| Parpaing creux B40 7,5×20×50 | 500×200×75 | 8,3 kg | idem | idem |
| Parpaing plein | — | — | — | non trouvé |
| Béton cellulaire 600×250, 50/70/100 mm | 600×250×e | — | colle joint 3 mm : 1,3 / 1,8 / 2,6 kg/m² | [Coeck](https://shop.adammateriaux.be/storage/products/6091/doc/fiche-technique-colle-pour-bloc-105-coeck-fr.pdf) |
| Béton cellulaire 150–250 mm | 600×250×e | — | mortier-colle 4,5–6 (15 cm) à 8–10 (25 cm) kg/m² | [Samse](https://private.samse.fr/catalogueWs/Fiche_technique/Fiche_technique_357991.pdf) |
| Carreau de plâtre plein 70 mm | 660×500×70 | 23,15 kg (≈ 70 kg/m²) | Placol 1,1–2,5 kg/m² | [Bricomarché/Placo](https://www.bricomarche.com/p/carreau-de-platre-plein-hydrofuge-joker-66x50cm-epaisseur-70mm/3496252010183) |
| Carreau de plâtre plein 100 mm | 660×500×100 | ≈ 33 kg (≈ 100 kg/m²) | idem | [Placo](https://www.placo.fr/documents/fiche-produit/ficheproduit-placol-1-heure-25kg.pdf) |
| Carreau de plâtre 50 mm | 660×500×50 | — | ≥ 1,1 kg/m² | non trouvé |
| Brique alvéolaire 20 cm (Calibric Th Max) | 500 × 200 × h variable | 7,9–22,5 kg | — | [Batiproduits](https://www.batiproduits.com/amp/fiche/produits/brique-alveolaire-de-11-a-31-4-cm-de-hauteur-p69321718.html) |
| Monomur 37,5 | 250 × 164–249 × 375 | 13,4–20,3 kg | — | [Batiproduits](https://www.batiproduits.com/amp/fiche/produits/brique-isolante-monomur-de-37-5-cm-de-hauteur-p69321428.html) |
| Brique de verre 190×190×80 | 190×190×80 | ≈ 2,4 kg (léger) à 4,5 kg (plein) | mortier armé | [Dakota](https://www.dakota.eu/hubfs/site-content/FR__0-st-111_5ea14b2fad4ce%20-%202df6501cb-1.pdf) |
| Brique de verre 240×240×80 | 240×240×80 | ≈ 2,4 kg (même fiche, à recouper) | idem | idem |

**Corrections à la liste** : les carreaux de plâtre sont en 660×500 (pas 666×500) ; l'épaisseur de 50 mm n'a aucune
source ; le format 300×300×100 du verre n'est pas confirmé. Fabricants Seves / Vitrablok : pas de joint en mm
publié dans les fiches trouvées (l'intervalle 10–30 mm vient de la fiche La Roche).

**Non couvert** : brique de cloison 5 cm et plâtrière 7 cm, parpaing plein, poids du béton cellulaire en 75/100/150/
200 mm. Ces fiches sont à compléter à la main dans la bibliothèque, ou par une seconde recherche si tu veux.
