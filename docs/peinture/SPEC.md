# Module peinture — spécification (cible V1)

Module de la boîte à outils (`src/modules/peinture/`), conforme au contrat de `docs/BOITE.md`.
Il chiffre la peinture des murs du plan commun : surface nette, produits, couches, litres, pots à acheter, coût.
Pas de calepinage : une pose de peinture n'a pas de dessin, seulement des surfaces et un système de couches.

## 1. Périmètre

| Fonction | V1 |
|---|---|
| Mur entier ou partie de mur (zone, coupes existantes de `core/coverage`) | Oui |
| Plusieurs murs d'une même pièce qui se suivent dans une même pose | Oui |
| Déduction des ouvertures (portes, fenêtres) avec seuil réglable | Oui |
| Finition (n couches), apprêt / sous-couche, enduit / rebouchage | Oui |
| Boiseries : plinthes, huisseries, vantaux de porte | Oui |
| Consommables (masquage, bâche, rouleau et bac, brosse) | Oui |
| Combinaison de pots de contenances différentes, au meilleur prix | Oui |
| Bibliothèque de peintures, modèles types | Oui |
| Couleur du mur dans la vue 3D | Oui (PE4) |
| Plafonds | Non (PE5 : demande une surface « plafond » dans le modèle) |
| Papier peint, enduits décoratifs, lasures extérieures | Non |

Règles de pose (contrôlées à la création, comme `docs/NAVIGATION.md` §4) :
- une pose de peinture ne couvre que des murs ; l'action est grisée sur un sol, avec la raison ;
- plusieurs murs dans une pose : murs qui se suivent dans une même pièce (`wallRuns`) ;
- une partie de mur déjà revêtue par une autre pose (carrelage en crédence) n'est pas comptée deux fois.

## 2. Données

```ts
// modules/peinture/core/types.ts (mm, litres et kg ; JSON simple)
export type PaintRole = 'finish' | 'primer' | 'filler';
export type PaintSheen = 'mat' | 'satin' | 'gloss';
export type Support = 'painted' | 'plaster' | 'concrete';     // ancien peint, plâtre / placo neuf, béton / crépi
export type SupportState = 'good' | 'average' | 'poor';        // pour l'enduit
export type Tint = 'light' | 'medium' | 'dark';

/** Produit de la bibliothèque `paints` (magasin IndexedDB `paints`). */
export interface Paint {
  id: Id;
  name: string;
  brand?: string;
  role: PaintRole;
  sheen?: PaintSheen;
  color?: { name: string; hex: string };
  tint?: Tint;
  /** Usage : murs, boiseries, pièces humides (plusieurs possibles). */
  uses: ('walls' | 'woodwork' | 'humid')[];
  /** Rendement par couche, m² par litre (m² par kg pour un enduit). */
  yield: number;
  /** Couches conseillées par le fabricant. */
  coats: number;
  /** Conditionnements : contenance en litres (kg pour un enduit) et prix du pot. */
  packs: { size: number; price: number | null }[];
  photoId: Id | null;
  // + schemaVersion, createdAt, updatedAt, brand, sheen, color : voir modules/peinture/core/paint.ts
}

/** Réglages d'une pose (modules.peinture.data.poses[poseId]). */
export interface PaintPoseSettings {
  finish: Id | null;                 // produit de finition des murs
  coats: number;                     // 2 par défaut
  primer: Id | null;                 // apprêt ; proposé selon le support
  filler: Id | null;
  fillerState: SupportState;         // 'good' : pas d'enduit
  support: Support;                  // 'painted' par défaut
  margin: number;                    // 0.10 : perte de chantier, sur les litres
  openings: { mode: 'all' | 'threshold' | 'none'; threshold: number };   // seuil en mm², 1 m² = 1_000_000
  woodwork: {
    skirting: boolean;               // plinthes : longueur au pied des murs peints, moins les portes
    skirtingHeight: number;          // 100 mm
    frames: boolean;                 // huisseries (portes et fenêtres) : périmètre × largeur de chambranle
    frameWidth: number;              // 120 mm
    doors: boolean;                  // vantaux : largeur × hauteur × faces
    doorFaces: 1 | 2;               // 2
    finish: Id | null;               // produit de finition des boiseries (usage `woodwork`)
    coats: number;                   // 2
    primer: Id | null;
  };
  consumables: { masking: boolean; sheet: boolean; roller: boolean; brush: boolean };
}
```

Les zones et poses vivent dans le projet (`core/coverage`) ; le module garde `PeintureData` : les
`PaintPoseSettings` de chaque pose et les prix saisis dans le projet (`prices`, par clé de ligne d'achat, communs à
toutes les poses, comme le parquet), avec un `schemaVersion` et ses migrations. Le moteur reçoit les prix à part
(`PaintSpec.prices`) et les produits sous la forme réduite `SpecPaint`.

## 3. Calcul d'une pose

Toutes les surfaces sont calculées en mm² puis converties en m² à la fin. Aucun arrondi avant le conditionnement.

### 3.1 Surface nette des murs
1. **Brute** : somme de `zoneArea` des zones de la pose (rectangles longueur × hauteur du mur, découpés par
   les coupes de la zone). Les zones d'une même surface ne se recouvrent pas (règle de `core/coverage`).
2. **Ouvertures** : `surfacePolygon` ne les retire pas. Le moteur intersecte chaque ouverture (rectangle
   `offset…offset + width` × `sill…sill + height`, repère du mur, y vers le haut) avec la région de la zone,
   puis retire celles que le réglage retient : `all` (toutes), `none`, `threshold` (surface de l'ouverture
   **strictement supérieure** au seuil, 1 m² par défaut). Le test porte sur l'ouverture entière, la déduction sur
   sa partie dans la zone.
3. **Nette** = brute − ouvertures retenues, jamais négative.

### 3.2 Couches
Pour chaque produit de la pose, avec `k` le coefficient de support (§3.3) :

`litres = surface × couches ÷ (rendement × k) × (1 + marge)`, arrondi **au millilitre supérieur**.

- **Finition** : `coats` couches. **Apprêt** : 1 couche. **Enduit** : kg = surface × `fillerRate(état)`
  (0 pour `good`, 0,3 pour `average`, 1,0 kg/m² pour `poor`), × (1 + marge), arrondi au gramme supérieur.
- Apprêt proposé par défaut si le support est `plaster` ou `concrete`, pas si `painted`.
- La teinte `dark` sur support `painted` produit l'alerte `dark-tint-coat` (une couche de plus conseillée),
  sans changer le calcul : l'utilisateur ajuste les couches.

### 3.3 Support
| Support | Coefficient `k` sur les rendements (apprêt et finition) |
|---|---|
| `painted` | 1,0 |
| `plaster` | 0,8 |
| `concrete` | 0,7 |

Valeurs indicatives, modifiables dans les Réglages du module ; les rendements de la fiche du fabricant
restent la référence.

### 3.4 Boiseries
Calculées par pose, sur les mêmes zones de mur :
- **Plinthes** : longueur au pied des murs peints (une zone compte si elle touche le sol, `y = 0`), moins la
  largeur des portes (`sill = 0`) dans la zone ; surface = longueur × `skirtingHeight`.
- **Huisseries** : par ouverture située dans les zones, périmètre (2 × hauteur + largeur pour une porte,
  2 × (largeur + hauteur) pour une fenêtre ou une porte-fenêtre) × `frameWidth`.
- **Vantaux** : par porte, largeur × hauteur × `doorFaces`.
- Surface de boiseries = somme des postes cochés ; mêmes formules de couches (§3.2) avec le produit
  `woodwork.finish`, `woodwork.coats`, apprêt `woodwork.primer` ; le coefficient de support vaut 1,0.

### 3.5 Pots
Entrée : besoin en millilitres (ou grammes), conditionnements du produit. Sortie : liste `(taille, nombre)`.
Algorithme déterministe (sac à dos non borné, programmation dynamique exacte, toutes les tailles, volume borné par
besoin + plus grand pot − 1, au-delà retirer un pot ne coûterait pas plus) : parmi les combinaisons dont le volume total ≥ besoin,
1. coût total minimal (un conditionnement sans prix exclut le critère de coût : on passe à 2) ;
2. puis surplus minimal ;
3. puis nombre de pots minimal ;
4. puis tailles les plus grandes (ordre stable).

### 3.6 Consommables
Forfaits modifiables, par pose :
- **masquage** : ⌈(périmètre des murs + périmètre des ouvertures) ÷ 50 m⌉ rouleaux ;
- **bâche** : ⌈surface au sol des pièces touchées ÷ 20 m²⌉ bâches (4 × 5 m) ;
- **rouleau et bac** : 1 kit ; **brosse à rechampir** : 1.
Ces lignes n'ont pas de produit en bibliothèque : prix saisis dans le projet.

### 3.7 Alertes (codes ; le texte est produit par l'interface)
`no-product` (pas de finition), `missing-yield` (rendement manquant ou nul), `no-pack` (produit sans
conditionnement), `no-surface` (surface nette nulle), `dark-tint-coat`, `primer-missing` (support neuf
sans apprêt), `product-use-mismatch` (produit hors de son rôle ou de son usage : murs, boiseries),
`opening-overlap` (ouvertures qui se recouvrent : surface déduite une seule fois).

## 4. Bibliothèque

Magasin `paints`, route `#/library/paints`. Fiche : champs de `Paint` (§2), photo facultative. Un produit
utilisé par un projet ne se supprime pas. Modèles types posés une seule fois (un modèle supprimé ne revient
pas) : blanc mat murs et plafonds, finition satinée pièces humides, peinture boiseries, sous-couche
universelle, enduit de rebouchage. Rendements et contenances types indicatifs, à vérifier sur le pot.

## 5. Achats

Lignes `ShoppingLine` : finition, apprêt, enduit (`finish`), consommables (`consumable`). `ShoppingUnit` gagne
`'pot'`. Quantité = nombre de pots d'une taille ; une combinaison produit une ligne par taille
(`key` = `peinture:<produit>:<rôle>:<taille>`), les besoins d'un produit sur plusieurs poses s'additionnent avant
le choix des pots (`core/aggregate.ts`), `detail` = « 6,4 L + 10 % ». Prix : bibliothèque (`priceFromLibrary`) ou saisi dans
le projet. Total par pose et pour le projet comme les autres modules.

## 6. Invariants (tests de propriétés, `fast-check`)

1. 0 ≤ surface nette ≤ surface brute.
2. Surface déduite : `none` ≤ `threshold` ≤ `all`.
3. Litres croissants avec les couches, décroissants avec le rendement, croissants avec la marge.
4. Les pots achetés couvrent le besoin (volume ≥ besoin) ; le coût de la combinaison ≤ celui de la meilleure
   combinaison à un seul format.
5. Pas de recouvrement : deux zones qui ne se recouvrent pas ne comptent jamais deux fois la même surface.
6. Une pose sans zone donne une surface nulle et l'alerte `no-surface`.
7. Déterminisme : même entrée, même résultat, JSON identique.

## 7. Cas de référence chiffrés

Pièce 4 000 × 3 000 mm, hauteur 2 500 mm, quatre murs entiers dans une pose. Une porte 830 × 2 040 mm
(1,6932 m²) et une fenêtre 1 200 × 1 250 mm (1,5 m²), toutes deux > 1 m², donc déduites.

| | Valeur |
|---|---|
| Brute | 14 m × 2,5 m = 35,000 m² |
| Ouvertures | 1,6932 + 1,5 = 3,1932 m² |
| Nette | 31,8068 m² |

**Cas A** : support ancien peint (k = 1), finition 2 couches à 10 m²/L, marge 10 %, sans apprêt.
Litres = 31,8068 × 2 ÷ 10 × 1,1 = 6,9975 L → 6 998 mL. Pots 1 L à 12 €, 2,5 L à 26 €, 5 L à 45 €, 10 L à 80 € :
meilleure combinaison **1 × 5 L + 2 × 1 L = 69 €** (7 L, surplus 2 mL) ; 5 + 2,5 L coûte 71 €, 10 L 80 €.

**Cas B** : mêmes murs, support plâtre neuf (k = 0,8), apprêt 1 couche à 10 m²/L, finition 2 couches à 10 m²/L.
Apprêt = 31,8068 ÷ 8 × 1,1 = 4,3734 L → 4 374 mL ; finition = 63,6136 ÷ 8 × 1,1 = 8,7468 L → 8 747 mL.

**Cas C** : plinthes du cas A, hauteur 100 mm. Longueur = 14 − 0,83 = 13,17 m ; surface = 1,317 m².

Les valeurs exactes des tests sont recalculées à la main avant d'écrire le moteur.
