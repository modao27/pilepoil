# Niveaux de sol et hauteurs propres (phase T1, N2) — spécification

Statut : **à valider** (aucun code). Origine : décision de l'utilisateur du 17 octobre 2026 (`docs/audit/PROPOSITIONS.md`
§3 bis) : deux pièces peuvent avoir un niveau de sol différent ; une marche dans une pièce est une estrade ; des murs
peuvent être plus bas que le plafond. Sans cette phase, ni les cloisons de hauteur propre (N3) ni les murets (N4) ne sont
possibles.

## 1. Ce que l'utilisateur peut faire

1. Donner à chaque pièce un **niveau de sol** (en cm, 0 par défaut) : « le séjour est 15 cm plus bas que le couloir ».
2. Voir et comprendre la **marche** entre deux pièces reliées par une porte (« marche de 15 cm, descendante vers le
   séjour »), avec le conseil de seuil correspondant (barre de seuil, nez de marche, rien si moins de 5 mm).
3. Revêtir chaque pièce comme avant ; une pose **qui traverserait une marche** est refusée avec une phrase claire.
4. Régler la **hauteur propre d'un mur** (mur bas, allège, muret contre plafond ouvert) : sa surface à revêtir en tient
   compte.
5. Voir tout cela dans la **maquette 3D** : sols aux bons niveaux, murs depuis leur propre sol, marche visible.
6. (Option, voir question B) **Estrade** dans une pièce : une zone du plan surélevée, avec ses contremarches et son
   dessus revêtables.

Hors périmètre : rampes et escaliers, plafonds inclinés ou à niveaux, épaisseur des revêtements (colle et carreau) dans
les cotes de niveau, pièces sur plusieurs étages.

## 2. Modèle (`core/plan`, millimètres)

| Champ | Type | Sens |
|---|---|---|
| `PlanRoom.floor?` | `number` (mm, absent = 0) | Niveau du **sol fini** de la pièce, par rapport au niveau 0 du plan. Positif : plus haut. |
| `PlanRoom.height` | inchangé | Hauteur sous plafond **depuis le sol de la pièce** (voir question A pour le plafond). |
| `Wall.height?` | `number` (mm, absent = hauteur de la pièce) | Hauteur propre du mur, depuis le sol de la pièce ; jamais plus que `PlanRoom.height`. |
| `PlanRoom.platforms?` | `Platform[]` (option B) | Estrades : `{ id, outline, height }`, contour dans le repère de la pièce, entièrement dans la pièce. |

Dérivés (non enregistrés) : `step(passage)` = niveau de la pièce B − niveau de la pièce A, signé ; une marche existe si
`|step| ≥ 5 mm`.

Compatibilité : tous les champs sont **facultatifs** ; absent = comportement actuel. Aucune conversion de projet, aucune
montée de version de base. Un plan sans niveau ni hauteur propre donne exactement les mêmes surfaces, quantités et
résultats qu'avant (invariant testé, parité carrelage verte).

## 3. Règles

- **Pose continue** (`core/coverage`) : continuer une pose d'une pièce à l'autre par un passage dont `|step| ≥ 5 mm` est
  refusé (`level-step`), message : « Les deux sols ne sont pas au même niveau (marche de 15 cm) : posez chaque pièce
  séparément. » Le choix « Nouvelle pose » reste offert. Un sol partagé de même niveau ne change pas.
- **Dérivation du plan v3** (travaux) : une pièce coupée par une cloison garde le niveau de la pièce d'origine ; deux
  pièces réunies par une démolition de mur n'ont qu'**un** niveau : démolition refusée (`level-mismatch`) si leurs niveaux
  diffèrent (« Ces deux pièces n'ont pas le même niveau de sol : alignez-les avant de démolir le mur. »).
- **Murs** : la surface d'un mur est sa longueur × sa hauteur propre (ou celle de la pièce) ; une ouverture plus haute que
  le mur est rognée. Un mur partagé entre deux pièces de niveaux différents se mesure depuis le sol de chaque côté.
- **Plinthes** : continues le long de la marche ; au droit d'un passage, la plinthe s'arrête de chaque côté.
- **Seuils** (parquet) : le conseil de barre de seuil tient compte de la marche : `< 5 mm` seuil plat, `5 à 20 mm` barre
  de rattrapage, `> 20 mm` nez de marche (texte indicatif, vérifier la notice du fabricant).
- **Peinture** : la surface d'un mur bas est celle de son mur ; rien d'autre ne change.
- **Cloisons** : une cloison entre deux pièces de niveaux différents est refusée en N2 (traité avec N3).

## 4. Interface

- Panneau de la pièce (plan) : champ « Niveau du sol » (cm, saisie du lot E, valeurs inhabituelles signalées : plus de
  ±100 cm). Panneau d'un passage : « Marche de 15 cm, descendante vers <pièce> » ou « Sans marche ».
- Panneau d'un mur : champ « Hauteur du mur » (cm), « Jusqu'au plafond » par défaut.
- Écran Pièce : rappel du niveau dans l'en-tête ; surfaces des murs bas à leur hauteur.
- Plan : la marche se dessine sur le passage (trait épais et flèche) ; pastille de niveau sur la pièce si ≠ 0.
- Glossaire : « niveau du sol », « marche », « seuil ».

## 5. Rendu et exports

- 3D (`render/scene3d`) : sol de chaque pièce à son altitude, murs de ce sol à sa hauteur propre, face de marche
  entre deux sols ; menuiseries dont l'allège est comptée depuis le sol de la pièce ; mode « coupés » inchangé.
- PDF : cote de niveau de chaque pièce et marche aux passages (page de plan et fiche de pièce).
- Achats : aucune ligne nouvelle (les surfaces changent, les articles non).

## 6. Fichiers touchés (estimation)

`core/plan/types.ts`, `validate.ts`, `reduce.ts`, `derive.ts`, `works.ts`, `walls.ts` ; `core/coverage/geometry.ts`,
`rules` (continuité) ; `modules/carrelage/state/surfaces.ts` (hauteurs de murs), `modules/parquet/core/*` (seuils,
plinthes) ; `render/scene3d/envelope.ts`, `cutaway.ts`, `equipment.ts` ; `ui/plan/*`, `ui/screens/Room.svelte`,
`ui/lib/glossary.ts`, PDF des modules ; `docs/MODEL.md`, `docs/BOITE.md`, `docs/NAVIGATION.md`.

## 7. Découpage en étapes (un commit chacune, tests avec)

1. **Modèle et invariants** : champs facultatifs, action de mise à jour, tests de propriétés (« sans niveau = comme
   avant »), parité verte.
2. **Marche et pose continue** : `step`, refus `level-step`, message, démolition refusée `level-mismatch`.
3. **Hauteurs propres des murs** : surfaces carrelage, peinture, parquet (plinthes), ouvertures rognées.
4. **Seuils et plinthes du parquet** selon la marche.
5. **Interface** : champs, panneau de passage, pastille et trait sur le plan, glossaire.
6. **3D et PDF** : altitudes, murs, marche, cotes.
7. (Option B) **Estrades** : zones surélevées, contremarches et dessus comme surfaces, 3D, achats.
8. Documents et e2e (390 px et ordinateur).

## 8. Questions à trancher avant de coder

- **A. Plafond** : la hauteur sous plafond est-elle mesurée **depuis le sol de chaque pièce** (le plafond suit le sol,
  simple) ou le **plafond est-il commun** à tout le plan (un sol plus bas donne une pièce plus haute) ?
- **B. Estrades** : dans cette phase (effort L au lieu de M, nouvelles surfaces revêtables) ou **phase suivante** (T1b) ?
- **C. Seuil de marche** : une différence de moins de 5 mm compte-t-elle comme « sans marche » ?
- **D. Niveau** : saisi comme **altitude du sol fini** (recommandé), ou du support avant revêtement ?
