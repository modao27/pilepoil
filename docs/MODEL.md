# Modèle de données et stockage

Unités : mm (géométrie, carreaux, ouvertures), ms depuis 1970 pour les dates, € pour les prix. Identifiants :
chaînes uniques (`crypto.randomUUID()`). Architecture d'ensemble : `docs/BOITE.md` §3–§5.

## Projet

```ts
interface Project {            // state/model.ts
  schemaVersion: 2;
  id: Id; name: string; createdAt: number; updatedAt: number;
  plan: Plan;                  // core/plan/types.ts : pièces, murs, ouvertures, obstacles, passages
  modules: Record<string, ModuleDoc>;   // clé = identifiant du module
}
interface ModuleDoc { schemaVersion: number; data: unknown }   // chaque module type ses données
```

- **Réducteur racine** (`state/project.ts`) : `project/rename`, `project/module/add`, `batch`, `plan/*` vers
  `core/plan/reduce.ts`, `<module>/*` vers `module.reduce(data, action, plan)` ; `plan/room/removed` est envoyé
  aux modules quand une pièce disparaît. Historique unique du projet (plan et modules).
- **Parquet** : `modules/parquet/state/model.ts` et `docs/parquet/SPEC.md` §2.

## Carrelage (`project.modules.carrelage`, schéma 2)

Le plan est la seule source de la géométrie : le carrelage ne garde que ses réglages, rangés par élément du plan.

```ts
interface CarrelageData {      // modules/carrelage/state/data.ts
  rooms: Record<Id, RoomTiling>;        // clé = id de pièce du plan ; absente : rien de carrelé
  settings: ProjectSettings;            // marge, réemploi, perte par coupe, chute minimale, nuance, objectif
  prices: Record<string, number>;       // prix unitaires par clé d'article de la liste d'achat
}
interface RoomTiling {
  floor: FloorTiling | null;
  walls: Record<Id, WallTiling>;        // clé = id de mur du plan ; absent : non carrelé
  outerCornersCovered: boolean;         // profilé sur les angles sortants entre murs carrelés
}
interface TilingBase { joint; split: 'h' | 'v'; zones: Zone[]; reservations: Reservation[]; junctionsCovered }
interface FloorTiling extends TilingBase { plinth: Plinth | null; edgesHidden: boolean }
interface WallTiling extends TilingBase {
  tiledHeight: number | null;           // null : jusqu'au plafond
  hiddenEdges: Edges;
  openings: Record<Id, OpeningFinish>;  // finitions des portes et fenêtres du plan (profilé, tableaux)
}
```

- **Zone** : taille (rangées, mm ou reste), carreau (`tileId`, debout ou couché), motif, angle, départ,
  décalage, mélange de couleurs, joint, retournements de photo.
- **Réservation** : prise, trappe, baignoire ou autre, dans le repère de la surface. Les portes et fenêtres
  viennent du plan ; seules leurs finitions sont au carrelage.
- **Surface résolue** (`state/surfaces.ts`, jamais enregistrée) : sol = boîte englobante du contour, contour et
  obstacles en trous ; mur i = longueur du segment × hauteur carrelée (bornée par la hauteur de la pièce),
  portes et fenêtres du plan (x depuis le point i) puis réservations. Identifiant `pièce~floor` ou
  `pièce~mur`, ordre : pièces du plan, sol puis murs dans l'ordre du contour.
- **Vue** `CarrelageProject` = champs communs + plan + `CarrelageData` + surfaces résolues (`carrelageView`).
- **Avertissements du plan** : réglages dont la pièce ou le mur n'existe plus (`planWarnings`), retirés par
  l'action `carrelage/prune` ; une pièce supprimée emporte ses réglages.

### Passage au moteur

`toProjectSpec(view, tiles)` : une `SurfaceSpec` par surface résolue (contour pour un sol), carreaux résolus
dans la bibliothèque (`a × b` selon debout ou couché, sens de réemploi par carreau), et `rooms` : joints entre
les surfaces d'une pièce (silicone aux angles rentrants et au pied des murs, profilés aux angles sortants).
`ProjectSpec.room` (pièce A–D) et `SurfaceSpec.corners` restent dans le moteur pour la parité avec legacy ;
l'application ne les remplit pas.

## Bibliothèques, photos, préférences

```ts
interface Tile {               // bibliothèque « tiles », partagée entre projets
  schemaVersion: 1; id; name;
  shape: 'rect' | 'hex' | 'octo' | 'chevron';
  length; width;               // hex/octo : largeur plat à plat, width = length
  thickness; color; photoId: Id | null;
  m2PerBox;                    // 0 = vendu à la pièce
  pricePerM2: number | null;
  orientation: 'free' | '180' | 'none';   // rotations permises au réemploi des chutes
  createdAt; updatedAt;
}
interface Photo { id; blob: Blob; width; height; createdAt }
type Pref = palette | theme | lastProjectId | showCutNumbers | librarySeeded;
```

Lames du parquet : bibliothèque « boards » (`modules/parquet/core/board.ts`). Une photo est supprimée quand plus
aucun carreau, lame ni scénario ne la référence.

## Scénarios A/B du carrelage (schéma 3)

Copie figée du projet entier et des carreaux utilisés ; au chargement, seules les données carrelage sont
rétablies (plan et autres modules gardés). Un scénario d'un schéma antérieur est supprimé à la lecture.

## IndexedDB (`idb`, base `pilepoil`, version 3)

| Magasin | Clé | Index | Contenu |
|---|---|---|---|
| `projects` | `id` | `updatedAt` | `Project` |
| `tiles` | `id` | `name`, `updatedAt` | `Tile` |
| `boards` | `id` | `name`, `updatedAt` | lames du parquet |
| `photos` | `id` | — | `Photo` (Blob) |
| `scenarios` | `id` | `projectId` | scénarios du carrelage |
| `prefs` | `key` | — | `Pref` |

Migrations à deux niveaux :
- **schéma de base** (`storage/db.ts`) : étapes dans l'ordre, jamais modifiées une fois publiées. v2 : magasin
  `boards` ; v3 : projets v1 (d'avant la boîte à outils) supprimés, sans conversion.
- **documents** : `schemaVersion` sur le projet et sur les données de chaque module ; `migrateProject` migre à
  la lecture (le document migré est réécrit en tâche de fond), puis chaque module migre ses données
  (`migrations[n]` passe de n − 1 à n). Module inconnu : laissé tel quel ; version future : refusée. Carrelage
  1 → 2 : données remises à vide (réglages et prix gardés). Chaque migration a son test.

## Store et historique

- `state/store.ts` : `createProjectStore(project, reduce)` expose `subscribe`, `dispatch`, `undo`, `redo`,
  `canUndo`, `canRedo` ; enregistrement différé (300 ms) dans IndexedDB.
- `state/history.ts` : passé / futur de 100 états ; les actions d'un même geste (clé de fusion, ex. glissement
  d'un motif, saisie d'un champ) fusionnent si elles arrivent à moins de 800 ms.
- Bibliothèques : hors historique du projet ; un carreau utilisé par un projet ne se supprime pas.

## Worker de calcul

`workers/compute.worker.ts` aiguille chaque demande vers le moteur du module (`modules/engines.ts`) :
`compute(spec)`, `optimize(spec)` par tranches avec progression et annulation. Deux clients : aperçu en direct
(seule la dernière demande compte) et file des vignettes et résumés.
