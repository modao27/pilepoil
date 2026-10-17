# Module cloisons — spécification (cible V1)

Module de la boîte à outils (`src/modules/cloisons/`), conforme au contrat de `docs/BOITE.md`.
Il chiffre les cloisons neuves en plaques de plâtre sur ossature métallique : rails, montants, plaques, isolant,
consommables. Les cloisons sont dessinées dans le plan (calque travaux, `docs/BOITE.md` §3 bis) ; le module ne les
dessine pas, il les calcule. Il ne revêt aucune surface : pas de pose, pas de zone.

**Rappel obligatoire dans toute l'interface et tous les PDF : « Vérifier la notice du fabricant. »** Les hauteurs
maximales, les entraxes, les fixations et les performances (feu, acoustique, humidité) dépendent du système complet
(DTU 25.41 et avis technique du fabricant) ; ce module chiffre des quantités, il ne certifie rien.

## 1. Périmètre

| Fonction | V1 |
|---|---|
| Cloisons droites neuves, d'un mur à un mur ou à une autre cloison (T, angle) | Oui |
| Systèmes 72/48, 98/48, 100/70 en bibliothèque, modifiables | Oui |
| Entraxe 600 ou 400 mm | Oui |
| Plaque par face : standard, hydrofuge, phonique, feu ; une ou deux couches selon le système | Oui |
| Isolant dans l'ossature | Oui |
| Portes et baies : rails interrompus, linteau, montants doublés | Oui |
| Montants doublés aux départs, liaisons en T et angles | Oui |
| Calepinage des plaques par face, joints décalés d'un entraxe, réemploi des chutes | Oui |
| Consommables par ratios réglables | Oui |
| Hauteur maximale par système et entraxe : table éditable, valeurs « à vérifier » | Oui |
| Élévation par cloison, nomenclature, achats, PDF | Oui |
| Démolitions : surface de mur démolie en information (pas d'achat, pas de gravats) | Oui |
| Doublages de murs, contre-cloisons, plafonds suspendus | Non |
| Hauteur propre d'une cloison (cloison basse, muret) : réglée dans le plan, lue par le module (N3) | Oui |
| Cloisons courbes ou inclinées en hauteur, cloisons vitrées | Non |
| Croisement de deux cloisons (une doit s'arrêter sur l'autre) | Non |
| Renforts pour charges lourdes (lavabo, placard) | Non |
| Plaques en montage horizontal | Non |
| Ossature et plaques en 3D (les cloisons apparaissent comme murs) | Non |

## 2. Données

### Dans le plan (`docs/BOITE.md` §3 bis)
`Partition` (axe, épaisseur, alignement, ouvertures) et `Demolition` vivent dans `project.site`. L'épaisseur est
copiée du système au tracé ; changer de système est une action groupée (épaisseur du plan + réglage du module).

### Bibliothèque de systèmes (magasin `systems`, route `#/library/systems`)

```ts
// modules/cloisons/core/system.ts (mm ; JSON simple)
export interface PartitionSystem {
  schemaVersion: 1;
  id: Id;
  name: string;                  // « 72/48 »
  /** Épaisseur finie nominale de la cloison. */
  thickness: number;             // 72, 98, 100
  /** Profondeur de l'ossature (montants et rails). */
  studWidth: number;             // 48, 48, 70
  /** Couches de plaque par face. */
  layers: 1 | 2;                 // 1, 2, 1
  plateThickness: number;        // 12.5, 12.5, 15
  createdAt: number;
  updatedAt: number;
}
```

Cohérence : `|thickness − (studWidth + 2 × layers × plateThickness)| ≤ 3` sinon alerte `system-thickness-mismatch`
(72/48 : 48 + 25 = 73 ; 98/48 : 48 + 50 = 98 ; 100/70 : 70 + 30 = 100). Modèles types posés une seule fois (un modèle
supprimé ne revient pas) : 72/48, 98/48, 100/70. **Les compositions des modèles types sont à vérifier sur la notice
du fabricant** (le 100/70 en particulier : plaque BA15 supposée). Un système utilisé par un projet ne se supprime pas.

### Données du module (`project.modules.cloisons`, schéma 1)

```ts
export interface CloisonsData {
  /** Réglages par cloison du plan, par identifiant de cloison ; absent : valeurs par défaut. */
  partitions: Record<Id, PartitionSettings>;
  settings: CloisonsSettings;        // §2.3
  /** Prix saisis dans le projet, par clé de ligne d'achat. */
  prices: Record<string, number>;
}

export interface PartitionSettings {
  system: Id | null;                 // bibliothèque `systems`
  /** null : hauteur sous plafond la plus basse des pièces voisines. */
  height: number | null;
  spacing: 600 | 400;                // entraxe
  /** Plaques : une entrée par face (a, b) ; les couches d'une face ont le même type. */
  plates: { a: PlateType; b: PlateType };
  insulation: Insulation | null;
  reinforcement: Reinforcement;
}
export type PlateType = 'standard' | 'hydro' | 'phonic' | 'fire';
export interface Insulation { kind: 'glass-wool' | 'rock-wool' | 'wood-fibre' }
export interface Reinforcement {
  ends: 'single' | 'double';         // montant de départ contre un mur ; défaut 'double'
  jambs: 'double';                   // montants de baie : toujours doublés
  junctions: 'single' | 'double';    // liaison en T et angle ; défaut 'double'
  woodInsert: boolean;               // renfort bois dans les montants de baie ; défaut false
}
```

Face `a` : côté de la normale (dy, −dx) de l'axe ; face `b` : l'autre. Les murs dérivés portent `of.face`.

### Réglages communs (`CloisonsSettings`)

```ts
export interface CloisonsSettings {
  /** Hauteurs maximales (§2.4), éditables. */
  maxHeights: HeightRule[];
  plateFormats: PlateFormat[];       // formats disponibles, longueur × largeur
  studLengths: number[];             // longueurs de montants vendues, mm
  railBar: number;                   // longueur d'un rail, 3000
  kerf: number;                      // 0 : coupe à la cisaille
  studClearance: number;             // jeu de hauteur d'un montant, 10
  plateGap: number;                  // plaque coupée plus courte que la hauteur, 10
  lintelBearing: number;             // appui du linteau de chaque côté, 50
  studMinGap: number;                // montant de trame supprimé s'il est plus près que ça d'un montant renforcé, 100
  minOffcut: number;                 // plus petite dimension d'une chute réutilisée, 150
  plateMargin: number;               // 0.05, sur le nombre de plaques
  insulationMargin: number;          // 0.05
  insulationPack: { m2: number; unit: 'roll' | 'pack' };   // 6.48 m² par rouleau (1,2 × 5,4 m), à régler
  ratios: ConsumableRatios;
}
export interface PlateFormat { length: number; width: number }   // 2500, 2600, 3000 × 1200
```

Valeurs par défaut : entraxe 600 ; formats 2500 × 1200, 2600 × 1200, 3000 × 1200 ; montants vendus 2500, 2600, 2700,
3000, 3500, 4000 ; rail 3000. Une largeur de plaque doit être un multiple de l'entraxe (1200 = 2 × 600 = 3 × 400) :
sinon alerte `plate-width-spacing`.

### Consommables : ratios réglables

```ts
export interface ConsumableRatios {
  screw25: { perM2: number; pack: number };   // vis 25 mm, 1re couche : 15 par m² de plaque, boîte de 1000
  screw35: { perM2: number; pack: number };   // vis 35 mm, couches suivantes : 12 par m², boîte de 1000
  jointTape: { perM2: number; pack: number }; // bande à joint : 1,5 m par m² de plaque, rouleau de 150 m
  jointCompound: { kgPerM2: number; pack: number }; // enduit : 0,5 kg par m² de plaque, sac de 25 kg
  resilientStrip: { pack: number };           // bande résiliente sous rails et montants de départ, rouleau de 30 m
  fixing: { spacing: number; pack: number };  // fixation des rails et montants de départ : tous les 600 mm + 1, boîte de 100
  cornerBead: { pack: number };               // cornière : une hauteur par angle sortant et bout libre, barre de 2,5 m
}
```

Tous ces ratios sont **indicatifs** et réglables dans les Réglages du module ; la notice du fabricant fait foi.

### 2.4 Hauteurs maximales (table éditable)

```ts
export interface HeightRule {
  system: string;            // nom du système (« 72/48 »), ou id
  spacing: 600 | 400;
  max: number | null;        // mm ; null : inconnu
  verified: boolean;         // false : « à vérifier »
  source: string;
}
```

Valeurs initiales, **toutes `verified: false`**. Ce sont des ordres de grandeur pour montants simples, non issus d'un
tableau lu en entier : la colonne « hauteurs limites » du tableau de performances Placostil (L'Intégrale Placo
2021-2022, cloisons distributives) n'a pas pu être relue ; quelques fiches système donnent 3,05 à 3,55 m pour des
montants doublés ou des plaques spécifiques, ce qui ne s'applique pas ici.

| Système | Entraxe | Hauteur max initiale | Source à confirmer |
|---|---|---|---|
| 72/48 | 600 | 2 600 | notice du fabricant du système choisi ; DTU 25.41 |
| 72/48 | 400 | 2 800 | idem |
| 98/48 | 600 | 3 000 | idem |
| 98/48 | 400 | 3 300 | idem |
| 100/70 | 600 | 3 400 | idem |
| 100/70 | 400 | 3 800 | idem |

L'utilisateur peut corriger chaque ligne et cocher « vérifié » en saisissant sa source. Toute valeur non vérifiée
s'affiche avec « à vérifier » ; la mention « Vérifier la notice du fabricant » est toujours visible à côté.

## 3. Entrée et sortie du moteur

Le moteur est **1D par cloison** : il ne voit pas le plan. `toSpec` (module) construit chaque cloison dans son repère
(x le long de l'axe depuis le départ, y depuis le sol) à partir de `project.site` et du plan après travaux.

```ts
export interface CloisonsSpec {
  partitions: SpecPartition[];       // dans l'ordre du plan
  systems: Record<Id, PartitionSystem>;
  settings: CloisonsSettings;
  /** Surface de murs démolis, m² (information, calculée par `toSpec`). */
  demolishedArea: number;
}
export interface SpecPartition {
  id: Id;
  name: string;                      // « Cloison 1 · Chambre / Couloir »
  system: Id;
  /** Longueur du corps, de face d'appui à face d'appui, mm. */
  length: number;
  height: number;
  spacing: 600 | 400;
  plates: { a: PlateType; b: PlateType };
  insulation: Insulation | null;
  reinforcement: Reinforcement;
  start: End; end: End;
  /** Liaisons en T de cloisons qui s'arrêtent sur celle-ci : abscisses le long de l'axe. */
  junctions: number[];
  openings: { id: Id; kind: 'door' | 'opening'; offset: number; width: number; height: number }[];
  /** Cloison carrelée sur une face (lu dans les zones du projet), pour l'alerte de plaque non hydrofuge. */
  tiledFaces: ('a' | 'b')[];
}
export type End = 'wall' | 'partition-t' | 'partition-corner' | 'free';
```

Longueur du corps : la partie de l'axe qui est dans les pièces de l'état existant, privée des bandes des autres
cloisons (une cloison qui s'arrête sur une autre s'arrête à sa face). Appui d'une extrémité (tolérance 20 mm) : mur
existant ou retour de démolition → `wall` ; bande d'une autre cloison → `partition-t` (extrémité au milieu de l'autre) ou
`partition-corner` (extrémités qui se rejoignent) ; sinon `free`. Hauteur : `PartitionSettings.height` ou la plus basse
des hauteurs des pièces voisines.

```ts
export interface CloisonsResult {
  partitions: PartitionResult[];
  totals: Totals;
  alerts: Alert[];                   // codes, §4.6
}
export interface PartitionResult {
  id: Id;
  ok: boolean;                       // false : erreur bloquante, exclue des totaux
  studs: StudLayout;                 // abscisses, longueurs, rôles (§4.2) pour l'élévation
  rails: RailPiece[];
  faces: { a: FaceLayout; b: FaceLayout };   // plaques posées, couches comprises (§4.3)
  insulationArea: number;            // m²
  alerts: Alert[];
}
export interface Totals {
  rails: Record<string, BarsResult>;     // par produit (largeur d'ossature), core/cutting/bars
  studs: Record<string, BarsResult>;     // par produit et longueur de barre
  plates: Record<string, PlateStock>;    // par type et format : feuilles, chutes
  insulation: { area: number; packs: number } | null;
  consumables: ConsumableLine[];
  demolishedArea: number;                // m², information
}
export interface Alert { code: string; partition?: Id; params?: Record<string, string | number> }
```

## 4. Moteur

Exécuté dans le worker. Déterministe : même `CloisonsSpec` → même résultat. Mesures en mm, surfaces converties en m²
à la fin.

### 4.1 Rails
Pour chaque cloison de longueur `L`, hauteur `H` :
- **rail haut** : une pièce de longueur `L`, continue (même au-dessus des portes) ;
- **rail bas** : `L` privée de chaque ouverture de type `door` ou `opening` (rail interrompu), donc 1 pièce par
  intervalle restant de longueur > 0 ;
- **linteau** : par ouverture, un rail de longueur `largeur + 2 × lintelBearing`, posé en tête de baie ;
- toutes les pièces d'un même produit (largeur d'ossature) sont groupées sur le projet et optimisées avec
  `core/cutting/bars.ts` (`railBar`, `kerf`). Une pièce plus longue qu'une barre est faite de plusieurs morceaux.

### 4.2 Montants
Longueur d'un montant plein : `H − studClearance`. Positions le long de l'axe :
1. **Trame** : `k × spacing`, `0 < k × spacing < L`.
2. **Extrémités** : un montant à `0` et à `L`. Contre un mur ou une cloison : montant de départ ; avec
   `reinforcement.ends = 'double'`, il est doublé (2 montants). Un bout `free` est doublé aussi.
3. **Baies** : à chaque bord de chaque ouverture, 2 montants (doublés ; `woodInsert` ajoute un renfort bois, §4.5).
4. **Liaisons en T** : à chaque abscisse de `junctions`, 1 montant, 2 si `junctions = 'double'`. Un angle
   (`partition-corner`) compte pour l'extrémité de la cloison, plus 1 montant supplémentaire si `junctions = 'double'`.
5. Un montant de trame à moins de `studMinGap` d'un montant renforcé (extrémité, baie, liaison) est supprimé.
6. Un montant de trame **dans** une baie devient un **montant court** au-dessus du linteau, de longueur
   `H − studClearance − hauteur de baie`. Si la baie est plus haute que `H − studClearance`, alerte `opening-too-tall`.
7. Tous les montants (pleins et courts) d'un produit et d'une longueur de barre sont optimisés ensemble par
   `core/cutting/bars.ts`. Longueur de barre d'une cloison : la plus petite de `studLengths` ≥ `H − studClearance`
   (pas de longueur vendue assez grande : erreur `no-stud-length`).

### 4.3 Plaques
Montage vertical, plaque coupée à `H − plateGap`. Le format est le plus petit de `plateFormats` de longueur ≥ `H − plateGap`
(aucun : erreur `no-plate-format`, cloison exclue des totaux).

Pour chaque face `f ∈ {a, b}` et chaque couche `k ∈ {1, …, layers}` :
1. **Décalage** : `o(f, k) = ((k − 1) + (f = b ? 1 : 0)) mod 2 × spacing`. Les joints d'une couche tombent donc à un
   entraxe des joints de l'autre couche, et ceux de la face b à un entraxe de ceux de la face a. Un joint tombe
   toujours sur un montant. **Correction (décidée le 2026-10-13)** : si un joint tombe à moins de `studMinGap` d'un bord de
   baie (là où le montant de trame est supprimé, donc sans montant dessous), le décalage de cette face et de cette
   couche passe à l'autre valeur permise (`o + spacing` modulo la largeur d'une plaque) ; si aucune des deux ne
   convient, le décalage normal est gardé avec l'alerte `joint-at-jamb`. Quand la correction fait coïncider les
   joints de deux couches ou de deux faces, alerte `joints-aligned`.
2. **Colonnes** : joints à `o + j × largeur de plaque` ; première colonne de largeur `o` (si `o > 0`), colonnes pleines,
   dernière colonne jusqu'à `L`.
3. **Découpe des baies** : dans chaque colonne, le rectangle de l'ouverture est retiré (plaque en L ou en U, jamais
   un joint au droit d'un montant de baie quand on peut l'éviter). La pièce occupe sa boîte englobante
   (largeur × `H − plateGap`) ; la surface couverte est l'aire réelle.
4. **Chutes** : toutes les pièces d'un même type de plaque (et même épaisseur) sur le projet forment un seul lot,
   triées par largeur décroissante puis par identifiant, placées au premier ajustement :
   - dans une chute du stock dont la largeur et la hauteur suffisent (sans rotation), la plus petite d'abord ;
   - sinon dans une feuille neuve du plus petit format qui convient, découpée en guillotine : la bande restante en
     largeur (`largeur de feuille − largeur de pièce`) devient une chute si sa dimension minimale ≥ `minOffcut`.
5. **Achat** : `feuilles = ⌈feuilles utilisées × (1 + plateMargin)⌉` par type et format.

### 4.4 Isolant
Si la cloison a un isolant : surface de la cavité = `L × H` moins la surface des ouvertures. Quantité =
`⌈surface × (1 + insulationMargin) ÷ insulationPack.m2⌉`. Une cloison phonique (`phonic`) sans isolant produit l'alerte
`phonic-without-insulation`.

### 4.5 Consommables
Les surfaces de plaque sont celles de §4.3 (aires réelles, toutes faces et couches). Pour les quantités :
- vis 25 mm : `perM2 × surface de la 1re couche` ; vis 35 mm : `perM2 × surface des couches suivantes` ;
- bande à joint : `perM2 × surface totale` ; enduit : `kgPerM2 × surface totale` ;
- bande résiliente : somme des longueurs de rails et des montants de départ contre un mur ;
- fixations : pour chaque rail et chaque montant de départ de longueur `ℓ`, `⌈ℓ ÷ spacing⌉ + 1` ;
- cornière : deux hauteurs (`H`) par bout libre (une par face) et une par angle (`partition-corner`) ;
- renfort bois (`woodInsert`) : 2 × (hauteur de baie + 100) mm par ouverture, en mètres, ligne « tasseau ».
Chaque ligne = `⌈quantité ÷ conditionnement⌉`.

### 4.6 Alertes (codes ; le texte est produit par l'interface)
`no-system`, `system-thickness-mismatch`, `height-over-max` (params : max, hauteur ; la valeur de la table est
« à vérifier »), `height-max-unknown`, `no-plate-format` et `no-stud-length` (bloquantes), `plate-width-spacing`,
`opening-too-tall`, `opening-near-end` (baie à moins de 100 mm d'un bout), `opening-wide` (baie de plus de 1,2 m : linteau
à justifier), `free-end` (bout sans appui), `short-run` (cloison de moins de 300 mm), `phonic-without-insulation`,
`fire-unchecked` (plaque feu : la performance dépend du système complet), `wet-face-plate` (face carrelée sans plaque
hydrofuge), `joint-at-jamb` (joint de plaque à moins de 100 mm d'un bord de baie, aucun décalage ne l'évite),
`joints-aligned` (les joints de deux couches ou de deux faces coïncident, après correction pour une baie).

## 5. Achats

Lignes `ShoppingLine` ; groupe `'structure'` : rails, montants, plaques, isolant ; groupe `'consumable'` : le reste.

| Ligne | Unité | Clé de prix |
|---|---|---|
| Rail R<studWidth> × barre | `bar` | `cloisons:rail:<largeur>` |
| Montant M<studWidth> × longueur | `bar` | `cloisons:stud:<largeur>:<longueur>` |
| Plaque <type> <longueur> × <largeur> | `piece` | `cloisons:plate:<type>:<format>` |
| Isolant | `roll` ou `pack` | `cloisons:insulation:<kind>` |
| Vis 25 mm, vis 35 mm | `box` | `cloisons:screw25`, `cloisons:screw35` |
| Bande à joint | `roll` | `cloisons:jointTape` |
| Enduit à joint | `bag` | `cloisons:jointCompound` |
| Bande résiliente | `roll` | `cloisons:resilient` |
| Fixations | `box` | `cloisons:fixing` |
| Cornière | `bar` | `cloisons:cornerBead` |
| Tasseau | `m` | `cloisons:woodInsert` |

`detail` : « 12 plaques + 5 % ». Prix saisis dans le projet (pas de bibliothèque de plaques en V1), communs à toutes les
cloisons. Total par module et pour le projet comme les autres modules.

## 6. Invariants (tests de propriétés, `fast-check`)

1. Rails : Σ longueurs des pièces = `2L − Σ largeurs d'ouverture + Σ linteaux` ; barres ≥ ⌈Σ ÷ `railBar`⌉.
2. Montants : positions triées, sans doublon hors montants doublés ; aucun montant plein dans une baie ; un joint de
   plaque tombe toujours sur un montant ; aucun montant de trame à moins de `studMinGap` d'un montant renforcé.
3. Plaques : Σ surfaces posées d'une face et d'une couche = `L × (H − plateGap)` − ouvertures ; feuilles ≥
   ⌈Σ surfaces ÷ surface d'une feuille⌉ ; chaque pièce tient dans sa feuille ; chaque chute réutilisée existe une fois.
4. Joints : les joints de deux couches d'une face, et de deux faces d'une cloison, ne coïncident jamais, sauf
   correction pour une baie (alerte `joints-aligned`) ; aucun joint à moins de `studMinGap` d'un bord de baie sauf
   alerte `joint-at-jamb`.
5. Monotonie : plus de hauteur, de longueur ou d'ouvertures ne diminue jamais les quantités de plaques ni de rails.
6. Une cloison à erreur bloquante est exclue des totaux et ne les fausse pas.
7. Déterminisme : même entrée, même résultat, JSON identique, même ordre de pièces.

## 7. Cas de référence chiffrés

Tous : système 72/48 (sauf R5), entraxe 600, `H = 2500`, formats par défaut, marge de plaques 0 (sauf mention),
`kerf = 0`, `studClearance = 10`, `plateGap = 10`, départs et liaisons doublés. Montant plein 2 490 mm, barre de 2 500 ;
plaque 2 490 mm de haut.

**R1** : `L = 3 000`, appuis sur deux murs, sans ouverture.
- Rails : 3 000 + 3 000 = 6 000 mm → **2 barres** (aucune chute).
- Montants : trame 600, 1 200, 1 800, 2 400 (3 000 est l'extrémité) = 4 ; extrémités 2 × 2 = 4 → **8 montants, 8 barres**.
- Plaques standard, face a (décalage 0) : colonnes 1 200 / 1 200 / 600 ; face b (décalage 600) : 600 / 1 200 / 1 200.
  Quatre pièces de 1 200 = 4 feuilles ; une cinquième dont on coupe un 600 (reste 600 × 2 500), qui sert à l'autre
  600 : **5 feuilles** ; avec marge 5 % : ⌈5,25⌉ = **6**.
- Surface de plaque par face 3,0 × 2,49 = 7,47 m², soit 14,94 m².
- Consommables (ratios par défaut) : vis 25 mm 15 × 14,94 = 224,1 → 225, **1 boîte** ; bande à joint 22,41 m → 23 m,
  **1 rouleau** ; enduit 7,47 kg, **1 sac** ; bande résiliente 6 000 + 2 × 2 490 = 10 980 mm, **1 rouleau** ;
  fixations : 2 rails × (⌈3 000 ÷ 600⌉ + 1 = 6) + 2 montants de départ × (⌈2 490 ÷ 600⌉ + 1 = 6) = 24, **1 boîte**.

**R2** : R1 avec entraxe 400.
- Trame : 400, 800, 1 200, 1 600, 2 000, 2 400, 2 800 = 7 ; + 4 aux extrémités → **11 montants**.
- Plaques : face a 1 200 / 1 200 / 600 ; face b (décalage 400) 400 / 1 200 / 1 200 / 200. La chute de 600 sert aux
  400, il reste 200 (≥ 150) pour la pièce de 200 : **5 feuilles**.

**R3** : `L = 4 000`, une porte 830 × 2 040 à l'abscisse 1 000 (baie de 1 000 à 1 830), appuis sur deux murs.
- Rails : haut 4 000, bas 1 000 + 2 170, linteau 830 + 2 × 50 = 930. Total 8 100 mm → **3 barres** (borne basse 3).
- Montants : trame 600, 1 200, 1 800, 2 400, 3 000, 3 600. 1 800 est à 30 mm du bord de baie (1 830) : supprimé ;
  1 200 est dans la baie : montant court de 2 490 − 2 040 = 450 mm. Pleins : 600, 2 400, 3 000, 3 600 = 4 ; baie
  1 000 et 1 830, doublés = 4 ; extrémités doublées = 4 → **12 pleins + 1 court = 13 montants, 13 barres** de 2 500
  (le court n'entre pas dans le reste de 10 mm d'un montant plein).
- Plaques standard, face a (décalage 0) : 1 200 (L autour de la baie) / 1 200 (L) / 1 200 / 400. Face b : le décalage
  normal (600) met un joint à 1 800, à 30 mm du bord de baie (1 830) : il est corrigé, la face b passe au décalage 0 et
  donne les mêmes colonnes que la face a (alerte `joints-aligned`). Six pièces de 1 200 = 6 feuilles ; les deux
  pièces de 400 sortent d'une septième (chute de 400 gardée) : **7 feuilles**.

**R4** : deux cloisons : P1 `L = 4 000` mur à mur ; P2 `L = 2 000` du mur de fond à la face de P1 (liaison en T à
l'abscisse 2 000 de P1).
- P1 : trame 600 … 3 600 (6) + extrémités 4 + liaison doublée 2 = **12 montants** ; P2 : trame 600, 1 200, 1 800 (3) +
  extrémités 4 = **7** ; total **19 montants**.
- Rails (regroupés) : pièces 3 000, 1 000, 3 000, 1 000 (P1) et 2 000, 2 000 (P2) = 12 000 mm → **4 barres**.

**R5** : système 98/48 (2 couches par face), `L = 3 000`, `H = 2 500`, face a hydrofuge, face b standard, isolant
laine de verre (rouleau de 6,48 m², marge 5 %).
- Décalages : (a, 1) 0 ; (a, 2) 600 ; (b, 1) 600 ; (b, 2) 0. Montants et rails comme R1 : **8 montants, 2 barres**.
- Hydrofuge : 4 colonnes de 1 200 et 2 de 600 → 4 feuilles + 1 feuille dont on coupe un 600 et dont la chute sert au
  second 600 : **5 feuilles**. Standard : idem, **5 feuilles**.
- Isolant : 3,0 × 2,5 = 7,5 m² × 1,05 = 7,875 m² → ⌈7,875 ÷ 6,48⌉ = **2 rouleaux**.
- Vis 25 mm sur les 2 premières couches (14,94 m²), vis 35 mm sur les 2 suivantes (14,94 m²).

**R6** : R1 avec `H = 2 800`.
- Alerte `height-over-max` (2 800 > 2 600, valeur à vérifier). Montant plein 2 790 → barre de 3 000. Plaque 2 790 → format
  3 000 × 1 200. Les quantités de rails et de montants sont celles de R1 ; les feuilles sont en 3 000 × 1 200.
- Avec `H = 3 200` : erreur `no-plate-format` (3 190 > 3 000), cloison exclue des totaux.

Les valeurs exactes sont recalculées à la main (et le détail noté dans le fichier de test) avant d'écrire le moteur.

## 8. Interface

Mêmes principes et composants que `docs/UX.md`.

### Calque travaux (éditeur de plan, `docs/PLAN.md` T0)
- Bascule **Existant | Travaux** dans la barre de l'éditeur. Existant : l'éditeur actuel, plus un verrou par mur
  (« Mur extérieur », « Mur porteur ») et « Verrouiller les murs extérieurs ». Travaux : l'état existant en fond
  (murs verrouillés hachurés et cadenassés), les pièces après travaux au premier plan, les murs démolis en pointillés.
- Outils : **Cloison** (deux touchers ; aimantation aux faces des murs, aux angles droits avec le départ et aux
  arêtes sur la droite de l'angle droit ; une face de la cloison est sur le trait tracé, l'épaisseur part à droite du
  sens de tracé par défaut, réglable : centrée ou à gauche ; 72 mm par défaut, puis celle du système), **Démolir**
  (toucher un mur de l'état existant : tout le mur, puis deux champs de cote pour réduire l'intervalle ; refusé sur un
  mur verrouillé, avec la raison), **Porte / baie** sur une cloison (champs de largeur, de distance et de hauteur).
  Glisser les points d'un bout déplace la cloison ; la perte de revêtement éventuelle est annoncée au relâchement.
- Avant de valider ce qui réduit une surface revêtue : liste par pose de ce qui est perdu, bouton « Annuler ».
- Tout est accessible sans pointeur par le panneau (liste des cloisons, démolitions, ouvertures, saisie des cotes).

### Écran du module (`#/p/:id/m/cloisons`)
Liste des cloisons (nom « Cloison 1 · Chambre / Couloir », longueur, hauteur, système, alertes) ; résumé permanent
« 4 cloisons · 31 plaques · 412 € » ; inspecteur d'une cloison : système, hauteur, entraxe, plaque par face,
isolant, renforts, ouvertures. Rappel « Vérifier la notice du fabricant » à côté de la hauteur et des plaques.

### Élévation par cloison (`#/p/:id/m/cloisons/c/:partitionId`)
Vue de face à l'échelle : rails, montants (pleins, courts, doublés, de départ), baies et linteaux, **calepinage des
plaques** d'une face et d'une couche au choix (joints, numéros de pièces, chutes réemployées en couleur de réemploi),
cotes des montants et des baies. Coupe des plaques en liste ordonnée (« Face a · couche 1 · pièce 3 : 1 200 × 2 490,
prise dans la chute C-2 »).

### Résultats et PDF
Section Résultats du module : Rails, Montants, Plaques (fiche de coupe), Isolant, Consommables, Achats. Un rapport par
cloison. PDF (base `ui/lib/pdf/doc.ts`) : plan des cloisons cotées, élévations, nomenclature et fiche de coupe, liste
d'achat ; la mention « Vérifier la notice du fabricant » en pied de page. Les cloisons apparaissent dans la 3D comme
murs de leurs pièces.

## 9. Performances
- Dérivation du plan (`planAfter`) pour 30 pièces et 40 cloisons : moins de 30 ms à froid ; moins de 10 ms quand on
  glisse une cloison (les groupes de pièces que le geste ne touche pas sont repris tels quels), pour tenir 60 i/s.
- Calcul des cloisons d'un appartement (20 cloisons) : < 100 ms.
- Élévation : dessin fluide (60 i/s) pour une cloison de 8 m avec deux couches.

## N3 — Hauteur propre d'une cloison (ajout du 17 octobre 2026)

- `Partition.height?` (plan, mm, absent = jusqu'au plafond) est la **seule** hauteur : le champ du plan et celui du module
  écrivent la même valeur. Ordre de lecture du module : plan, puis l'ancien réglage `PartitionSettings.height`, puis la
  plus basse des pièces voisines.
- Une cloison plus basse que les pièces qu'elle touche et qui **traverse** une pièce de part en part la sépare comme une
  cloison pleine ; ses faces sont des murs de la hauteur de la cloison (`Wall.height`, surfaces, 3D, PDF suivent).
- Une cloison basse qui **ne traverse pas** (bout libre, ou bouts sur un seul côté) est un **muret** : un obstacle dans
  le sol de la pièce (`Obstacle.height`), aucune pièce séparée, pas de faces à revêtir. Le module la chiffre quand même.
- Seule la cloison est regardée pour décider si elle traverse (pas les autres cloisons).
