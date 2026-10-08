# Modèle de données et stockage (phase 2)

Proposition. Unités : mm (surfaces, carreaux, ouvertures), ms depuis 1970 pour les dates, € pour les prix.
Les identifiants sont des chaînes uniques (`crypto.randomUUID()`).

## Types persistés

```ts
type Id = string;

interface Project {
  schemaVersion: 1;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Ordre = ordre d'affichage et de calcul (réemploi, numérotation des carreaux). */
  surfaces: Surface[];
  room: Room | null;
  settings: ProjectSettings;
  /** Prix unitaires par clé d'article de la liste d'achat (clés compatibles legacy). */
  prices: Record<string, number>;
}

interface ProjectSettings {
  margin: number;            // %
  reuseOffcuts: boolean;
  kerf: number;              // perte par coupe
  minOffcut: number;         // plus petite chute gardée
  shadeVariation: number;    // variation de nuance du rendu (0–1)
  optimizerGoal: 'thin' | 'tiles' | 'bal' | 'sym';
}

interface Room {
  length: number;
  width: number;
  height: number;
  tiledHeight: number;
  walls: Partial<Record<'A' | 'B' | 'C' | 'D' | 'floor', Id>>;   // id de surface
}

interface Surface {
  id: Id;
  name: string;
  kind: 'wall' | 'floor';
  width: number;
  height: number;
  joint: number;
  split: 'h' | 'v';
  zones: Zone[];             // au moins une
  openings: Opening[];
  corners: Corner[];
  plinth: Plinth | null;
  hiddenEdges: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  junctionsCovered: boolean;
}

interface Zone {
  id: Id;
  size: number;              // rangées, ou mm si unit = 'length'
  unit: 'rows' | 'length' | 'rest';
  tileId: Id;
  /** Carreau debout : long côté vertical à 0° (legacy : a < b). */
  tileUpright: boolean;
  pattern: PatternId;
  angle: 0 | 30 | 45 | 60 | 90;
  start: 'corner' | 'tile' | 'joint';
  offsetX: number;
  offsetY: number;
  mix: 'solid' | 'alternate' | 'random';
  colorB: string;            // seconde couleur du mélange
  groutColor: string;
  photoRandomFlip: boolean;  // rendu : retournements aléatoires de la photo
}

interface Opening {
  id: Id;
  type: 'window' | 'door' | 'socket' | 'trap' | 'tub' | 'other';
  x: number;
  sill: number;
  width: number;
  height: number;
  covered: boolean;
  revealDepth: number;       // mm (legacy : cm)
  reveals: { left: boolean; right: boolean; top: boolean; bottom: boolean };
  projection: number;        // avancée d'une baignoire
}

interface Corner { id: Id; x: number; type: 'in' | 'out'; angle: number; covered: boolean }

interface Plinth { length: number; height: number; zoneId: Id }

/** Bibliothèque globale, partagée entre projets. */
interface Tile {
  schemaVersion: 1;
  id: Id;
  name: string;
  /** Forme du produit : rect (droit, décalés, bâtons rompus, vannerie), hex, octo, chevron (lames Hongrie). */
  shape: 'rect' | 'hex' | 'octo' | 'chevron';
  length: number;            // long côté ; hex/octo : largeur plat à plat
  width: number;             // court côté ; hex/octo : = length
  thickness: number;
  color: string;
  photoId: Id | null;
  m2PerBox: number;          // 0 = vendu à la pièce
  pricePerM2: number | null;
  /** Rotations permises au réemploi des chutes (sens du veinage). */
  orientation: 'free' | '180' | 'none';
  createdAt: number;
  updatedAt: number;
}

interface Photo { id: Id; blob: Blob; width: number; height: number; createdAt: number }

/** Scénario A/B : copie figée du projet et des carreaux utilisés. */
interface Scenario {
  schemaVersion: 1;
  id: Id;
  projectId: Id;
  slot: 'A' | 'B';
  name: string;
  snapshot: { project: Project; tiles: Tile[] };
  metrics: Metrics;          // core/shopping/order.ts
  thumbnailId: Id | null;    // photo
  createdAt: number;
}

/** Préférences : palette, thème, dernier projet, import legacy fait. */
type Pref =
  | { key: 'palette'; value: { tiles: string[]; grouts: string[] } }
  | { key: 'theme'; value: 'auto' | 'light' | 'dark' }
  | { key: 'lastProjectId'; value: Id }
  | { key: 'legacyImport'; value: { at: number; projectId: Id | null } };
```

Écarts avec `DOMAIN.md` : `Tile.shape` (un hexagone est un produit, pas un motif) ; `Zone.tileUpright` (legacy
distingue 300 × 600 de 600 × 300 tourné à 90° : départs différents) ; sens du carreau sur `Tile` et non plus
global ; côtés en toutes lettres (`left`…). État d'interface (surface active, sélection, vue) hors du projet.

## Passage au moteur

`state/selectors.ts : toProjectSpec(project, tiles) → { spec: ProjectSpec, ids }` résout chaque zone :
`a = tileUpright ? width : length`, `b = tileUpright ? length : width` (hex/octo : `a = b = length`),
couleur, carton, épaisseur et sens viennent du carreau. `ids` relie indices du moteur et identifiants.
Carreau introuvable → erreur de surface `missing-tile`. Le moteur passe le sens de réemploi par carreau
(changement de `core` : `TileSpec.orientation`, `Settings.orientation` supprimé ; parité conservée car
l'import legacy copie le réglage global sur chaque carreau).

## IndexedDB (`idb`, base `calepinage`, version 1)

| Magasin | Clé | Index | Contenu |
|---|---|---|---|
| `projects` | `id` | `updatedAt` | `Project` |
| `tiles` | `id` | `name`, `updatedAt` | `Tile` |
| `photos` | `id` | — | `Photo` (Blob) |
| `scenarios` | `id` | `projectId` | `Scenario` |
| `prefs` | `key` | — | `Pref` |

Migrations à deux niveaux :
- **schéma de base** : `upgrade(db, oldVersion)` applique les étapes `v0→v1`, `v1→v2`… dans l'ordre ;
- **documents** : `schemaVersion` sur `Project`, `Tile`, `Scenario` ; `migrateProject(doc)` enchaîne les
  migrations à la lecture, réécrit le document migré. Chaque migration a un test avec un document figé.

Suppression d'une photo seulement si plus aucun carreau ni scénario ne la référence.

## Store et historique

- `state/actions.ts` : union d'actions (`zone/update`, `opening/add`, `surface/remove`…) et réducteur pur
  `reduce(project, action) → Project` (copies immuables, partage structurel).
- `state/history.ts` : passé / futur de 100 états ; les actions d'un même geste (`coalesceKey`, ex.
  `zone:<id>:offset` pendant un glissement, saisie d'un champ) fusionnent si elles arrivent à moins de 800 ms.
- `state/store.ts` : `createProjectStore(project)` expose `subscribe` (contrat des stores Svelte), `dispatch`,
  `undo`, `redo`, `canUndo`, `canRedo` ; enregistrement différé (300 ms) dans IndexedDB.
- Bibliothèque de carreaux : store séparé, hors historique du projet ; suppression refusée si un projet
  utilise le carreau.

## Worker de calcul

`workers/compute.worker.ts` (logique dans `workers/handler.ts`, testable sans worker) :

```
→ { type: 'compute', id, spec }                          ← { type: 'result', id, result: ProjectResult }
→ { type: 'optimize', id, surface, zones, goal, settings } ← { type: 'progress', id, zone, percent } … { type: 'optimized', id, result }
→ { type: 'cancel', id }                                 ← { type: 'cancelled', id }
```
- Calculs obsolètes : si plusieurs `compute` attendent, seul le dernier est calculé ; le client ignore toute
  réponse plus ancienne que sa dernière demande.
- Optimisation : le générateur avance par tranches (rendu de main entre tranches) pour traiter `cancel`.
- `workers/client.ts` : `compute(spec) → Promise`, `optimize(…, { onProgress, signal: AbortSignal })`.

## Import legacy

`storage/legacyImport.ts`, fonction pure `convertLegacy({ v3, v2, scenarios, palette })` puis écriture :
- normalisation identique à `normSurface` (valeurs par défaut legacy), `calepinage-v3` sinon `calepinage-v2` ;
- un carreau de bibliothèque par combinaison distincte (forme, dimensions, épaisseur, couleur, carton,
  photo, sens), nommé « 60 × 30 cm » ; photos `dataURL` → `Blob` ;
- `room.surf` (indices) → `room.walls` (ids) ; tailles de zone en cm et profondeur de tableau → mm ;
- prix : `tile|…` reportés sur le carreau quand la clé correspond, le reste dans `project.prices` ;
- scénarios A/B rattachés au projet importé, vignette en photo ; nuancier → préférence `palette` ;
- marqueur `legacyImport` : l'import ne se fait qu'une fois, les clés legacy ne sont jamais effacées.
- Critère : chaque configuration de `tests/parity` importée redonne les résultats extraits de legacy.

Deux sources :
- **même origine** (PWA servie à l'adresse où legacy était utilisé) : `autoImportLegacy` au premier lancement ;
- **fichier** : bouton « Exporter mes données » ajouté à legacy (fichier `calepinage-export-AAAA-MM-JJ.json`,
  `{ format: 'calepinage-legacy-export', version: 1, data: { <clé localStorage>: <texte> } }`), lu par
  `parseLegacyExport` puis `importLegacy`. Le bouton d'import de la PWA vient avec l'interface (phase 3).

Limites connues : un hexagone ou un octogone legacy saisi avec une hauteur b ≠ a devient un carreau a × a ;
les comptes sont identiques, seule la taille de grille de l'optimiseur peut différer. Les résultats legacy
d'une surface active autre que la première suivent l'ordre fixe des surfaces (voir DOMAIN.md).
