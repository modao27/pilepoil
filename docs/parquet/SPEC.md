# Module parquet — spécification (cible V3)

Module de la boîte à outils (`src/modules/parquet/`), conforme au contrat de `docs/BOITE.md`.
Il calcule la pose d'un parquet, d'un stratifié ou d'un vinyle clipsable sur les pièces du plan commun.

## 1. Périmètre

| Fonction | V3 |
|---|---|
| Pièces du plan : rectangles, L, polygones quelconques, obstacles, ouvertures | Oui |
| Pose droite à coupe perdue (« à l'anglaise ») | Oui |
| Pose droite à décalage régulier (½, ⅓, ¼, personnalisé) | Oui |
| Pose droite en diagonale (angle libre) | Oui |
| Longueurs mixtes (massif) | Oui |
| Bâton rompu (lames droites à 90°, lames A/B) | Oui |
| Point de Hongrie (extrémités en biais 45° ou 60°, lames A/B) | Oui |
| Plusieurs pièces posées en continu à travers les passages | Oui |
| Alertes de fractionnement, barres de seuil | Oui |
| Plinthes optimisées en barres | Oui |
| Plan 2D, fiche de coupe, liste d'achat, coût, PDF | Oui |
| Vue 3D | Oui |
| Mode chantier (suivi pièce par pièce sur téléphone) | Oui |
| Panneaux Versailles, frises, encadrements, marqueterie | Non |

Vocabulaire : « point de Hongrie » = chevron (extrémités en biais, joints alignés sur l'axe).
« Bâton rompu » = lames droites à 90° (herringbone).

## 2. Données du module

```ts
// src/modules/parquet/state/model.ts
export interface ParquetData {
  /** Une pose par groupe de pièces posées en continu. */
  layouts: Layout[];
  settings: ParquetSettings;
  accessories: Accessories;
  prices: Record<string, number>;
  /** Suivi chantier : pièces posées, valable pour une empreinte de calcul donnée. */
  worksite: { resultHash: string; done: string[] } | null;
}

export interface Layout {
  id: Id;
  name: string;
  /** Pièces du plan couvertes par cette pose (continuité entre elles via les passages). */
  rooms: Id[];
  boardId: Id;                       // lame de la bibliothèque
  pattern: Pattern;
  /** Degrés ; 0 = lames parallèles au mur de référence. */
  angle: number;
  reference: { room: Id; wall: Id } | null;       // null = plus long mur de la première pièce
  /** Motifs à axe : position de l'axe. */
  axis: 'room-center' | 'main-door' | 'reference-wall' | { point: Point };
  /** Décalage manuel de l'origine du motif (glisser sur le plan). */
  offset: Point;
  method: 'floating' | 'glued' | 'nailed';
  rules: LayingRules;
  /** Seuils posés par l'utilisateur (fractionnement), segments dans le repère du plan. */
  breaks: Segment[];
  seed: number;
}

export type Pattern =
  | { kind: 'random-stagger' }                       // coupe perdue
  | { kind: 'regular-stagger'; step: number }        // 1/2, 1/3, 1/4 ou fraction libre
  | { kind: 'herringbone' }                          // bâton rompu
  | { kind: 'chevron'; endAngle: 45 | 60 };          // point de Hongrie

export interface LayingRules {
  expansionGap: number;              // jeu périphérique et autour des obstacles
  minCutLength: number;              // coupe mini en bout de rang
  minJointOffset: number;            // décalage mini entre joints de rangs voisins
  minEdgeRowWidth: number;           // largeur mini du premier/dernier rang
  balanceEdgeRows: 'if-needed' | 'always';
  maxFloatingLength: number;         // au-delà : alerte de fractionnement
  maxFloatingWidth: number;
  minPassageWidth: number;           // passage plus étroit : seuil conseillé
}

export interface ParquetSettings {
  reuseOffcuts: boolean;
  kerf: number;                      // perte par coupe (lame de scie)
  /** Marge d'achat en % ; null = valeur par défaut du motif (5 / 10 / 12 %, tableau ci-dessous). */
  marginPct: number | null;
}

export interface Accessories {
  underlay: { enabled: boolean; m2PerRoll: number; overlap: number } ;
  vaporBarrier: { enabled: boolean; m2PerRoll: number; overlap: number; upstand: number };
  skirting: { enabled: boolean; barLength: number; height: number; mitreAllowance: number };
  thresholds: { barLength: number };
  glue: { m2PerUnit: number } | null;
  fixings: { perM2: number } | null;
}
```

### Bibliothèque de lames (globale, magasin `boards`)

```ts
export interface Board {
  schemaVersion: 1;
  id: Id;
  name: string;
  kind: 'solid' | 'engineered' | 'laminate' | 'vinyl';
  /** Longueurs disponibles ; une seule = longueur fixe. */
  lengths: number[];
  /** Proportion de chaque longueur dans un paquet (somme = 1), longueurs mixtes. */
  lengthMix: number[] | null;
  /** Largeur utile, hors languette. */
  width: number;
  thickness: number;
  profile: 'click' | 'tongue-groove';
  /** Lames gauche/droite (bâton rompu, point de Hongrie). */
  handed: boolean;
  color: string;
  photoId: Id | null;
  boardsPerPack: number;             // par variante si handed ; c'est lui qui sert au calcul des paquets
  m2PerPack: number;                 // affichage et contrôle de cohérence seulement
  pricePerPack: number | null;
  createdAt: number;
  updatedAt: number;
}
```

Paquets : le nombre de paquets se calcule avec `boardsPerPack`. Si `m2PerPack` s'écarte de plus de 3 %
de `boardsPerPack × surface d'une lame` (longueur moyenne pondérée par `lengthMix`), le formulaire de lame
affiche une alerte (code `pack-mismatch`), sans bloquer l'enregistrement.

Modèles types : au premier lancement, la bibliothèque contient 5 à 10 lames génériques sans marque, à
dupliquer et ajuster : stratifié 1285 × 192, vinyle clipsable, contrecollé 1900 × 190, massif à
longueurs mixtes, bâton rompu 600 × 100 (lames A/B), point de Hongrie 45° et 60°. Prix vides. Un modèle
supprimé ne revient pas.

### Valeurs par défaut

| Règle | Stratifié / vinyle | Contrecollé flottant | Massif |
|---|---|---|---|
| Jeu périphérique | 8 mm | 10 mm | 12 mm |
| Coupe mini en bout | 300 mm | 300 mm | 250 mm |
| Décalage mini des joints | 300 mm | 300 mm | 200 mm |
| Largeur mini rang de bord | 50 mm | 50 mm | 50 mm |
| Longueur / largeur maxi sans fractionnement | 10 m / 8 m | 12 m / 10 m | sans objet (collé, cloué) |
| Passage mini sans seuil | 1200 mm | 1200 mm | sans objet |
| Marge d'achat | 5 % droit, 10 % diagonale, 12 % motifs | idem | idem |
| Trait de scie | 3 mm | 3 mm | 3 mm |

L'interface affiche « Vérifier la notice du fabricant » à côté des règles.

Marge : tant que `marginPct` vaut `null`, elle suit le motif et l'angle de la pose (changer de motif la
met à jour). Dès que l'utilisateur la saisit, elle ne bouge plus ; un bouton « Revenir à la valeur
conseillée » la remet à `null`.

Décidé (2026-10-08) : le type de lame (`Board.kind`) donne les valeurs (`core/defaults.ts`), et une pose collée
ou clouée désactive les alertes de fractionnement et de passage. « Sans objet » s'écrit `null` dans les règles
(sérialisable en JSON).

## 3. Entrée et sortie du moteur

```ts
// src/modules/parquet/core/types.ts
export interface ParquetSpec {
  layouts: LayoutSpec[];             // une par Layout, pièces résolues depuis le plan
  /** marginPct résolu par toSpec (jamais null ici). */
  settings: ParquetSettings & { marginPct: number };
  accessories: Accessories;
}

/** Toutes les coordonnées sont dans le repère du plan : `toSpec` applique l'origine de chaque pièce. */
export interface LayoutSpec {
  id: string;
  rooms: { id: string; outline: Polygon; obstacles: Polygon[]; openings: WallOpeningSpec[] }[];
  /** depth = épaisseur du mur traversé par le passage. */
  passages: { a: string; b: string; segment: Segment; width: number; depth: number }[];
  board: BoardSpec;
  pattern: Pattern;
  angle: number;
  referenceDirection: Point;         // vecteur unitaire du mur de référence
  axis: Point | 'room-center' | 'main-door' | 'reference-wall';  // proposition résolue par le moteur
  offset: Point;
  method: 'floating' | 'glued' | 'nailed';
  rules: LayingRules;
  breaks: Segment[];
  seed: number;
}

export interface ParquetResult {
  layouts: LayoutResult[];
  skirting: SkirtingResult;
  totals: { area: number; boards: number; boardsA: number; boardsB: number; wastePct: number; cuts: number };
  hash: string;                      // empreinte de l'entrée (suivi chantier)
}

export interface LayoutResult {
  id: string;
  /** Surface posable (pièces − jeux − obstacles), repère du plan. */
  layable: Polygon[];
  pieces: LaidPiece[];
  boards: BoardUse[];                // lames neuves et ce qu'on y taille
  offcuts: Offcut[];                 // chutes restantes en fin de calcul
  thresholds: Segment[];             // seuils proposés ou imposés
  warnings: ParquetWarning[];
  errors: ParquetError[];
}

export interface LaidPiece {
  id: string;                        // stable pour une même entrée : 'L1-R03-P02', 'L1-C-14-A'
  room: string;
  row: number | null;                // pose droite
  line: number | null;               // motifs : rang le long de l'axe
  polygon: Polygon;                  // repère du plan
  variant: 'A' | 'B' | null;
  length: number;                    // longueur utile de la pièce, repère lame
  cutType: 'full' | 'straight' | 'angled' | 'complex';
  /** Coupes dans le repère lame (origine bout gauche, x le long de la lame). */
  cuts: Segment[];
  source: { board: number } | { offcut: string };
  ripped: boolean;                   // coupée en largeur (rang de bord, contournement)
}

export type ParquetWarning =
  | { code: 'edge-row-narrow'; room: string; width: number }
  | { code: 'cut-too-short'; piece: string; length: number }
  | { code: 'joint-offset'; row: number; offset: number }
  | { code: 'fractioning-needed'; length: number; width: number }
  | { code: 'narrow-passage'; passage: string; width: number }
  | { code: 'tiny-piece'; piece: string; area: number };

export type ParquetError =
  | { code: 'invalid-room'; room: string }
  | { code: 'missing-board' }
  | { code: 'board-too-short-for-rules' }   // minCutLength + minJointOffset > longueur de lame
  | { code: 'too-many-pieces'; estimate: number };
```

## 4. Moteur

Exécuté dans le worker. Déterministe : même `ParquetSpec` → même résultat (graine `seed`).

### 4.1 Surface posable
1. Pour chaque pièce : contour réduit de `expansionGap` (offset négatif), moins chaque obstacle agrandi de
   `expansionGap`.
2. Groupe de continuité : union des surfaces des pièces de la pose, reliées par les passages (le passage
   est la bande `width × depth`, `depth` étant l'épaisseur du mur porteur de l'ouverture dans le plan).
3. Seuils (`breaks` + seuils proposés retenus) : la surface est coupée le long de chaque seuil, avec un jeu
   de chaque côté. Chaque morceau est calculé avec le même repère de motif.

### 4.2 Pose droite
1. Repère de pose : axe des lames = `referenceDirection` tourné de `angle`. Toute la suite se fait dans ce
   repère, puis on revient au repère du plan.
2. **Rangs** : bandes de largeur = largeur utile, perpendiculaires à l'axe des lames.
3. **Équilibrage** : `if-needed` → décaler la grille si le dernier rang fait moins de `minEdgeRowWidth` ;
   `always` → premier et dernier rang de même largeur. Le décalage manuel `offset` s'ajoute ensuite.
4. **Segments** : bande ∩ surface. Une bande peut donner plusieurs segments (obstacle, pièce en L). Mur en
   biais : la pièce de bout est trapézoïdale, longueur prise sur le bord le plus long, `cutType: 'angled'`.
5. **Remplissage 1D** de chaque segment, dans le sens de pose :
   - première pièce : chute compatible du stock (longueur ≥ `minCutLength`, joint décalé d'au moins
     `minJointOffset` des joints du rang précédent), sinon lame neuve coupée à la longueur voulue ;
   - lames entières ensuite ;
   - dernière pièce coupée ; le reste va au stock s'il fait au moins `minCutLength` (moins `kerf`) ;
   - si la dernière pièce ferait moins de `minCutLength`, raccourcir la première pièce d'autant (et
     prendre une autre chute ou une lame neuve) ; si aucune solution, alerte `cut-too-short` ;
   - coupe perdue : le décalage découle des chutes ; décalage régulier : imposé par `step`, une chute n'est
     prise que si elle donne exactement la longueur voulue (± 2 mm), et le départ du motif est choisi pour
     que tous les débuts et fins de rang respectent `minCutLength`.
6. **Rangs de bord coupés en largeur** : `ripped: true`, leur reste en largeur n'est pas réutilisé
   (languette ou rainure perdue).
7. **Longueurs mixtes** : tirage pondéré par `lengthMix` (générateur pseudo-aléatoire de `core/hash`),
   sous les mêmes contraintes.
8. **Optimisation** (`optimize`, en tranches annulables) : 20 décalages de départ × 10 graines par défaut.
   Score = perte en mm² + pénalités :
   - joints alignés à deux rangs d'écart (moins de `minJointOffset`) ;
   - effet escalier : même décalage sur plus de 3 rangs consécutifs (coupe perdue) ;
   - pièces proches du minimum (< 1,2 × `minCutLength`).
   Le meilleur départ est appliqué à `offset` et `seed` par une action, annulable.

### 4.3 Bâton rompu et point de Hongrie
1. Géométrie des motifs : réutiliser `herring` et `chevron` du carrelage avec joint 0, après les avoir
   déplacés dans `src/core/patterns/` (partagé). La parité carrelage doit rester verte après ce déplacement.
   Ajouter l'angle d'extrémité 60° au point de Hongrie (le carrelage n'a que 45°).
2. Les cellules de parité 0 et 1 deviennent les variantes A et B. À vérifier sur le code de `herring` au
   début de P2 : la parité doit bien correspondre aux lames gauche / droite.
3. Placement : le motif est tourné de `angle` autour de `axis`, puis décalé de `offset`. Proposer trois
   placements d'axe (centre de la pièce, centre de la porte principale, aligné sur le mur de référence) et
   afficher pour chacun la plus petite largeur de coupe en bord.
   À 0°, l'axe du motif est parallèle au mur de référence. Le moteur calcule les trois propositions
   (`axisOptions` du résultat) et résout celle que la pose désigne par son nom ; « porte principale » = la plus
   large des portes et portes-fenêtres, à défaut le centre de la pièce. « Aligné sur le mur de référence » :
   une limite de bande sur le bord posable le long de ce mur, pour ne pas avoir de bande coupée en long.
4. Découpage : chaque cellule ∩ surface posable (booléens de `core/geometry`). Classement :
   `full` (≥ 99,9 % de l'aire), `straight` ou `angled` (une seule ligne de coupe), `complex` (plusieurs ou
   contournement), alerte `tiny-piece` sous 15 % de l'aire ou sous 20 mm de largeur.
5. **Réemploi des chutes** : chaque pièce coupée est exprimée dans le repère de sa lame. Reste R = lame − P.
   Une autre pièce Q de même variante peut être tirée de R si Q tient dans R **sans rotation ni miroir**
   (profils). S'inspirer de `polyReuse` du carrelage (complément polygonal), appariement glouton par aire
   décroissante, plus petite chute compatible d'abord.
6. Comptes A et B séparés pour l'achat.

### 4.4 Multi-pièces et fractionnement
- Une pose couvre plusieurs pièces : un seul repère de motif, les rangs ou l'axe traversent les passages.
- Pose flottante : si la surface (ou un morceau entre seuils) dépasse `maxFloatingLength` ou
  `maxFloatingWidth` dans le repère des lames, alerte `fractioning-needed` avec une proposition de seuil
  au passage le plus étroit.
- Passage plus étroit que `minPassageWidth` : alerte `narrow-passage` et seuil proposé.
- L'utilisateur accepte une proposition (elle passe dans `breaks`) ou crée deux poses séparées.

### 4.5 Plinthes (`core/cutting/bars.ts`, partagé)
1. Longueurs : chaque mur de chaque pièce, moins les ouvertures au sol (portes, baies), autour des obstacles
   si l'option est cochée.
2. Optimiseur de barres 1D générique : premier ajustement décroissant puis amélioration locale, avec
   `kerf` et `mitreAllowance` par coupe d'angle.
3. Sortie : nombre de barres, liste de coupes par mur, chutes.

### 4.6 Achats
- Lames : `ceil(lames utilisées × (1 + marge) / boardsPerPack)` paquets, par variante si `handed`
  (lames A et B comptées et emballées séparément). `m2PerPack` n'entre pas dans le calcul.
- Sous-couche : surface posable × (1 + recouvrement) / m² par rouleau.
- Pare-vapeur : surface + recouvrement des lés + remontée périphérique.
- Plinthes : barres. Seuils : un par seuil, barre coupée à la largeur.
- Colle ou fixations selon `method`.
- Clés de prix stables : `parquet:board:<id>[:A|:B]`, `parquet:underlay`, `parquet:skirting`…

### 4.7 Invariants (tests de propriétés)
- Somme des aires des pièces = aire posable (écart < 0,1 %).
- Aucun chevauchement entre pièces ; aucune pièce hors surface posable.
- Toute pièce tient dans sa lame source ; somme des pièces d'une lame ≤ aire de la lame.
- Règles respectées, ou alerte correspondante présente.
- Lames à acheter ≥ lames utilisées ≥ 1.
- Même entrée → même résultat, même `hash`.
- Identifiants de pièces stables pour une même entrée.

### 4.8 Cas de référence
| Cas | Entrée | Attendu |
|---|---|---|
| R1 | pièce 4000 × 3000, lame 1285 × 192, jeu 8, coupe perdue, `if-needed` | 16 rangs, dernier rang 104 mm, surface posable 11,888 m², lames utilisées entre 50 et 54, au plus 52 après optimisation |
| R2 | R1 avec `always` | premier et dernier rang de 148 mm |
| R3 | R1, décalage régulier ½ | joints de deux rangs voisins décalés de 642,5 mm ± kerf, aucune pièce < 300 mm (le départ s'ajuste) |
| R4 | pièce en L 5000 × 4000 moins 2000 × 2000, poteau 200 × 200 | invariants verts, aucun rang sans pièce |
| R5 | couloir 6000 × 1100, bâton rompu, lame 600 × 100 | invariants verts, A et B à ± 2 lames |
| R6 | mur en biais à 30° | pièces `angled` sur le bord, invariants verts |
| R7 | deux pièces 4000 × 3000 reliées par une porte de 830 | une seule pose, alerte `narrow-passage`, rangs continus |
| R8 | pièce 12000 × 5000 en stratifié flottant | alerte `fractioning-needed` |
| R9 | lame 400 × 70 avec coupe mini 300 et décalage 300 | erreur `board-too-short-for-rules` |

Les valeurs exactes de R1 à R3 servent de test d'acceptation ; vérifier le calcul à la main avant d'écrire
le test et noter le détail dans le fichier de test.

## 5. Interface

Mêmes principes et composants que `docs/UX.md`.

**Éditeur** (`#/p/:id/m/parquet`) : plan des pièces de la pose au centre, lames dessinées, glisser pour
décaler le motif (aimantation à la largeur de lame), toucher une lame pour voir ses coupes.
Panneau tiré (téléphone) ou inspecteur (ordinateur), onglets :
- **Lame** : choix dans la bibliothèque ou nouvelle lame.
- **Pose** : motif (icônes), angle, mur de référence, axe (3 propositions avec la plus petite coupe), mode
  de pose, optimiser.
- **Pièces** : pièces couvertes par la pose, continuité, seuils proposés à accepter.
- **Finitions** : plinthes, sous-couche, pare-vapeur, seuils.
- **Règles** : valeurs du tableau du §2 avec rappel « Vérifier la notice du fabricant ».

Résumé permanent : « 52 lames · 6 paquets · perte 4 % · 389 € ». Toucher = Résultats.

**Résultats** (`/results`) : onglets Plan, Coupes, Achats, 3D. Export PDF : plan coté à l'échelle,
fiche de coupe, liste d'achat (A4, jsPDF, sur le modèle de `ui/lib/pdf.ts`).

**Fiche de coupe** : dans l'ordre de pose.
```
Salon — rang 3
  1. chute C-07, 612 mm               bout gauche
  2–5. lames entières × 4
  6. lame neuve → couper à 842 mm      la chute C-12 (358 mm) va au stock
```
Motifs : par ligne le long de l'axe, schéma de la coupe en biais avec ses cotes.

**Chantier** (`/chantier`) : une ligne ou un rang à la fois, grandes cibles, cocher les pièces posées.
La progression est gardée dans `worksite` avec l'empreinte du calcul ; si le calcul change, prévenir et
proposer de repartir de zéro.

**3D** : sol des pièces avec la texture de la lame orientée pièce par pièce, plinthes, murs bas ; réutiliser
la base de scène three.js existante (`render/scene3d`). 60 i/s sur un téléphone récent pour 30 m².

## 6. Performances
- 30 m² en pose droite : calcul < 300 ms.
- 100 m² en point de Hongrie, optimisation comprise : < 2 s, interruptible.
- Garde-fou `too-many-pieces` au-delà de 20 000 pièces estimées.
