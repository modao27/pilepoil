# Architecture de la boîte à outils

Ce document décrit le socle commun à tous les modules. Il part de l'application carrelage existante
(phases 1 à 7 terminées, voir `docs/carrelage/PLAN.md`) et la transforme sans changer ses résultats.

## 1. Principes

- Un **projet** contient un **plan** (pièces dessinées une fois) et les données de chaque **module** activé.
- Chaque module lit le plan, calcule dans le worker et produit : un rendu 2D, une fiche de coupe, des lignes
  d'achat, une scène 3D.
- La liste d'achat du projet additionne les lignes de tous les modules.
- Le socle reste mince : il ne contient que ce dont au moins deux modules ont besoin.

## 2. Contrat de module

Deux faces : une face moteur (pure, exécutée dans le worker) et une face application (état et interface).

```ts
// src/modules/types.ts

/** Face moteur : importable par le worker, sans DOM ni Svelte. */
export interface ModuleEngine<Spec, Result> {
  id: ModuleId;
  /** Calcul complet ; doit être déterministe pour une même entrée. */
  compute(spec: Spec, ctx: EngineContext): Result;
  /** Calcul long découpé en tranches (optimisation), annulable. Facultatif. */
  optimize?(spec: Spec, ctx: EngineContext): Generator<Progress, Result>;
}

/** Face application : état, sélecteurs, écrans. */
export interface ToolModule<Data, Spec, Result> {
  id: ModuleId;                       // 'carrelage' | 'parquet' | …
  label: string;                      // « Carrelage »
  description: string;                // une phrase pour l'accueil du projet
  icon: string;                       // tracé SVG 34 × 24, trait fin
  schemaVersion: number;
  /** Données initiales quand on active le module sur un projet. */
  create(plan: Plan): Data;
  /** Réducteur pur des actions du module. */
  reduce(data: Data, action: ModuleAction, plan: Plan): Data;
  /** État → entrée moteur. Renvoie les erreurs bloquantes sans lever d'exception. */
  toSpec(project: Project, libraries: Libraries): { spec: Spec } | { errors: ModuleError[] };
  /** Lignes d'achat consolidables. */
  shopping(result: Result, data: Data, libraries: Libraries): ShoppingLine[];
  /** Résumé court pour la carte du module (« 46 carreaux, 312 € »). */
  summary(result: Result): ModuleSummary;
  /** Migrations des données du module, par version. */
  migrations: Record<number, (doc: unknown) => unknown>;
  /** Écrans, chargés à la demande. */
  screens: {
    editor: () => Promise<Component>;
    results: () => Promise<Component>;
    worksite?: () => Promise<Component>;       // mode chantier
  };
  /** Bibliothèque de produits propre au module (carreaux, lames…). Facultatif. */
  library?: LibraryDefinition;
}
```

Registre : `src/modules/registry.ts` exporte la liste ordonnée des `ToolModule`, et
`src/modules/engines.ts` la liste des `ModuleEngine` (seul fichier importé par le worker).

Précisions (décidées le 2026-10-08) :
- `ModuleId` est un `string` (liste ouverte) : ajouter un module ne touche pas aux types communs.
- `types.ts` est écrit en entier dès S1, y compris les types encore non définis ici (`EngineContext`,
  `Progress`, `ModuleAction`, `ModuleError`, `ModuleSummary`, `Libraries`, `LibraryDefinition`).
  En S1, le carrelage n'implémente que la face moteur et `id`, `label`, `icon`, `screens` ; le reste
  (`create`, `reduce`, `toSpec`, `shopping`, `summary`, `migrations`, `library`) est branché en S2 et S3.
- `screens` ne couvre pas tous les écrans du carrelage (pièce 3D, comparaison, assistant, fiche carreau) :
  le contrat doit permettre à un module de déclarer ses propres routes sous `#/p/:id/m/<id>/…`. À fixer
  en écrivant `types.ts`.
- Pendant S1 seulement, la coquille (`ui`, `storage`) peut importer `modules/carrelage/index.ts`, jamais un
  fichier interne du module. Une règle ESLint l'impose ; les tests peuvent importer les internes.
  Ces imports disparaissent en S2–S3 au profit du registre.

## 3. Plan commun

```ts
// src/core/plan/types.ts
export interface Plan {
  rooms: PlanRoom[];
  passages: Passage[];               // portes ou ouvertures reliant deux pièces
}

export interface PlanRoom {
  id: Id;
  name: string;
  /** Contour intérieur fini des murs, mm. Sens horaire à l'écran (y vers le bas) : signedArea > 0. */
  outline: Polygon;
  /** Un mur par segment du contour : walls[i] = segment du point i au point i + 1. */
  walls: Wall[];
  obstacles: Obstacle[];             // trous dans le sol (poteau, îlot, conduit, trémie)
  openings: WallOpening[];           // portes, baies, fenêtres, sur un segment du contour
  height: number;                    // hauteur sous plafond, pour la 3D
  /** Position de la pièce dans le plan d'ensemble (les pièces se placent les unes par rapport aux autres). */
  origin: Point;
}

export interface Wall {
  id: Id;                            // stable : ne change pas quand on ajoute ou retire un point
  thickness: number;                 // épaisseur du mur, mm (passages, 3D)
}

export interface Obstacle {
  id: Id;
  kind: 'post' | 'island' | 'duct' | 'other';
  outline: Polygon;                  // repère de la pièce
}

export interface WallOpening {
  id: Id;
  kind: 'door' | 'french-window' | 'window';
  wall: Id;                          // mur porteur de l'ouverture
  offset: number;                    // depuis le début du mur (point i)
  width: number;
  sill: number;                      // 0 pour une porte
  height: number;
}

export interface Passage {
  id: Id;
  a: { room: Id; opening: Id };
  b: { room: Id; opening: Id };
}
```

Validation (`core/plan/validate.ts`) : contour simple (non croisé), au moins 3 points, aire > 0, obstacles
dans la pièce, autant de murs que de segments, épaisseurs > 0, ouvertures sur leur mur, passages entre
deux ouvertures de même largeur (± 10 mm) qui se font face à une distance égale à l'épaisseur du mur
(± 10 mm). Les erreurs sont des codes.

Murs et contour (réducteur du plan) : ajouter un point coupe un mur en deux ; les deux moitiés gardent
son épaisseur, la première garde son `id`, chaque ouverture va sur la moitié qui la contient (`offset`
recalculé). Retirer un point fusionne deux murs : le mur fusionné garde l'`id` du premier, les ouvertures
de l'autre y sont reportées.

Un passage est la bande `largeur de l'ouverture × épaisseur du mur` entre les deux pièces : c'est ce qui
relie les surfaces des pièces voisines (pose continue du parquet, 3D).

`core/hash` reçoit en S2 un générateur pseudo-aléatoire à graine et une empreinte stable d'un objet JSON
(suivi chantier, cache) ; l'actuel `hash(i)` du carrelage ne change pas.

Géométrie nécessaire (`core/geometry/boolean.ts`) : union, différence, intersection, décalage (offset)
de polygones non convexes avec trous. Le carrelage garde ses fonctions actuelles (convexes) pour ne pas
toucher à la parité. Choisir une bibliothèque déterministe qui tourne dans un worker (piste : `clipper2-js`
en coordonnées entières au 1/100 mm, ou `polygon-clipping`) ; l'envelopper derrière nos propres fonctions
pour pouvoir en changer.

Lien avec le carrelage : dans le socle, le carrelage garde ses surfaces rectangulaires et sa pièce
A/B/C/D. Une pièce rectangulaire du plan pourra plus tard créer automatiquement les surfaces du carrelage
(hors périmètre de ce plan de travail).

## 4. Modèle persisté v2

```ts
export interface Project {
  schemaVersion: 2;
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
  /** Données de chaque module activé, avec leur propre version ; clé = ModuleId. */
  modules: Record<string, ModuleDoc>;
}

/** Chaque module type et valide ses propres `data` (par exemple `CarrelageData`). */
export interface ModuleDoc {
  schemaVersion: number;
  data: unknown;
}

/** Données carrelage = l'ancien projet v1 sans les champs communs. */
export interface CarrelageData {
  surfaces: Surface[];
  room: Room | null;
  settings: ProjectSettings;
  prices: Record<string, number>;
}
```

Migration `v1 → v2` (testée sur des documents figés) :
- `surfaces`, `room`, `settings`, `prices` passent dans `modules.carrelage.data` ;
- `plan` vide ; si `room` existe, créer une pièce rectangulaire `length × width` nommée comme le projet,
  murs de 100 mm d'épaisseur par défaut ;
- aucune autre donnée ne change.

Scénarios A/B : le magasin `scenarios` appartient au module carrelage (types, lecture, écriture, migration).
Son `snapshot` est migré comme un projet. Un autre module pourra avoir ses propres scénarios plus tard.

IndexedDB : nouvelle version de base qui ajoute le magasin `boards` (bibliothèque de lames du parquet,
index `name`, `updatedAt`). Les photos restent communes.

Nom de l'application (S3) : la base devient `pilepoil`. Au premier lancement, les données de l'ancienne
base `calepinage` sont copiées une fois (avec un test), puis l'ancienne base est conservée sans être
modifiée, comme filet de sécurité, jusqu'à une version ultérieure qui la supprimera.

## 5. Store et actions

- Actions préfixées : `plan/room/add`, `plan/room/update`, `plan/opening/add`…, `carrelage/zone/update`,
  `parquet/layout/update`…
- Le réducteur racine aiguille : `plan/*` vers `core/plan/reduce.ts`, `<module>/*` vers `module.reduce`.
- Historique annuler/rétablir unique au niveau du projet (mécanisme existant, `coalesceKey` conservé).
- Supprimer une pièce du plan : chaque module est prévenu par une action `plan/room/removed` et nettoie
  ses données liées.

## 6. Worker

```ts
type Request =
  | { type: 'compute'; id: number; module: ModuleId; spec: unknown }
  | { type: 'optimize'; id: number; module: ModuleId; spec: unknown }
  | { type: 'cancel'; id: number };
```
Le principe actuel est conservé : seul le dernier calcul en attente par module est traité, réponses
anciennes ignorées, optimisation en tranches annulable.

L'application ouvre deux workers : l'aperçu en direct (dernier calcul seul) et les vignettes (toutes les
demandes, l'une après l'autre). Les deux restent. L'optimisation du carrelage
(`surface, zones, goal, settings`) passe par une `spec` qui regroupe ces arguments.

## 7. Liste d'achat consolidée

```ts
// src/core/shopping/types.ts
export interface ShoppingLine {
  module: ModuleId;
  key: string;                       // unique dans le module, stable (sert de clé de prix)
  group: 'covering' | 'underlay' | 'finish' | 'consumable' | 'tool';
  label: string;                     // « Stratifié chêne 1285 × 192 »
  quantity: number;                  // en unité de vente
  unit: 'pack' | 'box' | 'roll' | 'bar' | 'bag' | 'sachet' | 'tube' | 'cartridge' | 'litre'
      | 'piece' | 'm2' | 'm';                // sachet, cartridge, litre : unités actuelles du carrelage
  detail?: string;                   // « 49 lames + 5 % »
  unitPrice: number | null;
}
```
- Le carrelage convertit ses `ShoppingItem` actuels en `ShoppingLine` (adaptateur, sans toucher au calcul).
- Prix : chaque module garde ses prix ; l'écran Achats du projet les affiche et les modifie via le module.
- Écran « Achats » du projet : regroupé par magasin type (revêtements, sous-couches, finitions,
  consommables), total par module et total général, export PDF et CSV.

## 8. Navigation

```
Accueil (projets)
 └─ Projet  #/p/:id                       cartes des modules activés + « Ajouter un outil », résumé, total
     ├─ Plan  #/p/:id/plan                éditeur de pièces commun
     ├─ Carrelage  #/p/:id/m/carrelage/…   routes actuelles du carrelage, préfixées
     ├─ Parquet    #/p/:id/m/parquet       éditeur ; /results ; /chantier
     └─ Achats #/p/:id/achats             liste consolidée
Bibliothèques  #/library/tiles, #/library/boards
Réglages
```
Les anciennes routes (`#/p/:id/s/:surfaceId`, `#/p/:id/results`, `#/p/:id/room`, `#/p/:id/compare`)
redirigent vers les nouvelles, pour ne pas casser les favoris. En S1, `#/p/:id` redirige vers
`#/p/:id/m/carrelage` ; il devient l'écran Projet en S2. En S3, `#/library` et `#/library/:tileId`
redirigent vers `#/library/tiles…`.

## 9. Éditeur de plan

- Création rapide : rectangle (longueur × largeur), forme en L, en U, ou dessin libre point par point.
- Cotes modifiables directement sur chaque mur (champ numérique avec calcul accepté).
- Aimantation aux angles droits et à la grille (10 mm par défaut).
- Ajout d'ouvertures sur un mur, d'obstacles dans la pièce.
- Plusieurs pièces sur le même plan, déplaçables ; un passage se crée en reliant deux portes.
- Mêmes gestes que l'éditeur carrelage (pincer, glisser, toucher = sélection, panneau tiré).

## 10. Ce qui ne change pas

Design system, composants, moteur et résultats du carrelage, import legacy, PWA, déploiement GitHub Pages.

Le code commun est extrait quand un second module en a besoin, pas avant : en S1, le PDF, la scène 3D et
les motifs bâton rompu / Hongrie partent avec le reste du carrelage dans `modules/carrelage/`. Les motifs
redescendent dans `core/patterns` en P2, la base du PDF dans `ui/lib` en P4, la base de scène 3D dans
`render/scene3d` en P5. Seule exception prévue : `core/cutting/bars.ts` (P4), partagé d'emblée même si
seul le parquet s'en sert au début.

## 11. Journal des décisions

| Date | Décision | Où |
|---|---|---|
| 2026-10-08 | Nom de l'application : **Pilepoil** (identifiant technique `pilepoil`) | S3 |
| 2026-10-08 | Code commun extrait quand un second module en a besoin (PDF, 3D, motifs) | §10 |
| 2026-10-08 | En S1, la coquille peut importer `modules/carrelage/index.ts`, rien d'autre | §2 |
| 2026-10-08 | Contrat écrit en entier en S1, rempli par le carrelage en S1–S3 | §2 |
| 2026-10-08 | `ModuleId` ouvert, `Project.modules` en `Record<string, ModuleDoc>` | §2, §4 |
| 2026-10-08 | Murs avec identifiant stable et épaisseur propre ; ouvertures rattachées à l'`id` du mur | §3 |
| 2026-10-08 | Magasin `scenarios` géré par le module carrelage | §4 |
| 2026-10-08 | Renommage complet : base `pilepoil` avec copie depuis `calepinage`, manifeste et dépôt renommés | §4, PLAN S3 |
| 2026-10-08 | Unités d'achat communes étendues à `sachet`, `cartridge`, `litre` | §7 |
| 2026-10-08 | Parquet : contours envoyés au moteur dans le repère du plan, modèles types de lames, marge qui suit le motif, paquets comptés en lames | `parquet/SPEC.md` |
