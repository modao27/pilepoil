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
export interface ModuleEngine<Spec, Result, OptSpec = Spec, OptResult = Result> {
  id: ModuleId;
  /** Calcul complet ; doit être déterministe pour une même entrée. */
  compute(spec: Spec, ctx: EngineContext): Result;
  /** Calcul long découpé en tranches (optimisation), annulable. Facultatif. */
  optimize?(spec: OptSpec, ctx: EngineContext): Generator<Progress, OptResult>;
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
  /** État → entrée moteur. Renvoie les erreurs bloquantes sans lever d'exception. `context` : ce que les autres
   *  modules disent du projet, rassemblé par la coquille (`ui/lib/projectContext`). */
  toSpec(project: Project, libraries: Libraries, context: ProjectContext): { spec: Spec } | { errors: ModuleError[] };
  /** Pied des murs (plinthe peignable ou non, sol sans plinthe, mur carrelé depuis le sol), tiré des seules données
   *  du module : les autres le lisent par `context.wallBases` (`core/coverage/wallBase`). Facultatif. */
  wallBases?(project: Project, libraries: Libraries): WallBase[];
  /** Lignes d'achat consolidables. */
  shopping(result: Result, data: Data, libraries: Libraries, plan: Plan): ShoppingLine[];
  /** Action qui fixe le prix d'une ligne (null : revenir au prix de la bibliothèque). */
  priceAction(key: string, value: number | null): ModuleAction;
  /** Résumé court pour la carte du module (« 46 carreaux, 312 € »). */
  summary(result: Result): ModuleSummary;
  /** Résultats par pose, pièce et projet (N5) : rapport par pose (chiffres exacts sur la portée, quantités du
   *  calcul avec leur portée), section de l'écran Résultats commun, pages PDF et maillages 3D (repère du plan,
   *  sans l'enveloppe commune `render/scene3d/envelope`), tout chargé à la demande. */
  results(): Promise<ModuleResults<Result>>;
  /** Réducteur, entrée moteur, achats, résumé : chargés à la demande (`ModuleLogic`) ; la coquille attend
   *  `loadModules()` (registre) avant d'ouvrir un projet. Le reste de ce contrat est le manifeste, chargé au
   *  démarrage. */
  logic(): Promise<ModuleLogic<Data, Spec, Result, Action>>;
  /** Migrations des données du module, par version. */
  migrations: Record<number, (doc: unknown) => unknown>;
  /** Écrans, chargés à la demande. */
  screens: {
    editor: () => Promise<Component>;
    routes?: ModuleRoute[];                    // écrans propres sous #/p/:id/m/<id>/…
    create?: () => Promise<Component>;         // #/new/<id> : assistant de création
    card?: () => Promise<Component>;           // carte du projet sur l'accueil
    settings?: () => Promise<Component>;       // section des Réglages
  };
  /** Démarrage, base ouverte, avant le chargement des projets. Facultatif. */
  start?(db: Db): Promise<void>;
  /** Photos utilisées hors des bibliothèques (scénarios…), gardées au ramassage. Facultatif. */
  usedPhotos?(db: Db): Promise<Id[]>;
  /** Bibliothèque de produits propre au module (carreaux, lames…). Facultatif. */
  library?: LibraryDefinition;
}
```

Registre : `src/modules/registry.ts` exporte la liste ordonnée des `ToolModule`, et
`src/modules/engines.ts` la liste des `ModuleEngine` (seul fichier importé par le worker).

Chaque module a deux points d'entrée, un par face : `modules/<id>/index.ts` (le `ToolModule`, écrans
chargés à la demande) et `modules/<id>/engine.ts` (le `ModuleEngine`, pur), importé seulement par
`engines.ts`. Ainsi le worker n'embarque jamais d'interface. Règles ESLint correspondantes.

Précisions (décidées le 2026-10-08) :
- `ModuleId` est un `string` (liste ouverte) : ajouter un module ne touche pas aux types communs.
- `types.ts` est écrit en entier dès S1, y compris les types encore non définis ici (`EngineContext`,
  `Progress`, `ModuleAction`, `ModuleError`, `ModuleSummary`, `Libraries`, `LibraryDefinition`).
  En S1, le carrelage n'implémente que la face moteur et `id`, `label`, `icon`, `screens` ; le reste
  (`create`, `reduce`, `toSpec`, `shopping`, `summary`, `migrations`, `library`) est branché en S2 et S3.
- `screens` ne couvre pas tous les écrans du carrelage (pièce 3D, comparaison, assistant, fiche carreau) :
  le contrat doit permettre à un module de déclarer ses propres routes sous `#/p/:id/m/<id>/…`. À fixer
  en écrivant `types.ts`.
- Depuis S3, la coquille ne voit les modules que par `modules/registry.ts` (modules et bibliothèques),
  `modules/types.ts` et `modules/engines.ts` (worker). Une règle ESLint l'impose ; les tests peuvent importer
  les internes. Le magasin `scenarios` et les types du carrelage sont dans le module.
- Bibliothèques : déclarées par les modules (`LibraryDefinition`, avec `templates` facultatifs), tenues par la
  coquille (chargement, migration, modèles types posés une seule fois, routes `#/library/<id>`).

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

Épaisseur par défaut d'un mur : **72 mm**, cloison placo standard 72/48 (une plaque BA13 de chaque côté
d'une ossature de 48 mm). Elle sert pour tout nouveau mur et pour la migration v1 → v2 ; l'utilisateur la
modifie mur par mur.

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

## 3 bis. Plan v3 : état existant et travaux

Décidé le 2026-10-13 pour le module cloisons (`docs/cloisons/SPEC.md`). **Raison** : relever l'appartement tel qu'il
est, puis dessiner des cloisons neuves et des démolitions, sans perdre ni l'état d'origine ni les revêtements déjà
posés ; carrelage, parquet et peinture travaillent sur les pièces **après travaux**.

### Types

```ts
// core/plan/types.ts
export interface Plan { rooms: PlanRoom[]; passages: Passage[] }   // inchangé : un état du logement

export interface Wall {
  id: Id; thickness: number;
  /** Mur qu'on ne démolit pas : extérieur ou porteur. Absent : libre. */
  locked?: 'exterior' | 'bearing';
  /** Mur dérivé : face d'une cloison neuve (jamais saisi, jamais enregistré). */
  of?: { partition: Id; face: 'a' | 'b' };
}

/** Plan v3, ce qui est enregistré. */
export interface Site {
  existing: Plan;              // état des lieux relevé (murs verrouillés compris)
  partitions: Partition[];     // cloisons neuves
  demolitions: Demolition[];   // démolitions de murs existants
}

export interface Partition {
  id: Id;
  /** Axe tracé de a vers b, repère du plan, mm. */
  a: Point; b: Point;
  /** Épaisseur finie (72 par défaut) : c'est elle qui découpe les pièces. Copiée du système au tracé. */
  thickness: number;
  /** Épaisseur centrée sur l'axe, ou d'un seul côté (gauche : côté de la normale (dy, −dx), à l'écran). */
  align: 'center' | 'left' | 'right';
  openings: PartitionOpening[];
}
export interface PartitionOpening {
  id: Id;
  kind: 'door' | 'opening';    // opening : baie sans porte
  offset: number;              // depuis a, le long de l'axe
  width: number; height: number;
}

export interface Demolition {
  id: Id;
  room: Id; wall: Id;          // mur de l'état existant
  from: number; to: number;    // intervalle le long du mur, depuis son point i, mm
}
```

Les cloisons existantes non porteuses sont des murs en vis-à-vis de l'état existant (§3) : on les démolit, on ne les
« modifie » pas.

### Projet v4 : enregistré et en mémoire

```ts
interface Project {            // state/model.ts, schéma 4
  site: Site;                  // enregistré
  plan: Plan;                  // APRÈS travaux = planAfter(site), en mémoire, jamais enregistré
  // … zones, poses, modules inchangés
}
```

- `planAfter(site)` (`core/plan/derive.ts`) est une fonction **pure** de `site`. Le réducteur racine recalcule
  `plan` après chaque action qui change `site`, et le chargement le recalcule : rien de dérivé n'est lu sur disque.
  Sans cloison ni démolition, `planAfter(site) === site.existing` (même référence : coût nul, aucun risque pour les
  projets sans travaux).
- **Tout lecteur de pièces lit `project.plan`** (après travaux), comme aujourd'hui : carrelage, parquet, peinture,
  couverture, 3D, résultats. Seuls l'éditeur de plan, le réducteur et le module cloisons lisent `project.site`.
  Invariant testé : `project.plan === planAfter(project.site)` après chaque action.
- Le champ enregistré s'appelle `site` (et non `plan`) pour qu'un document ancien ne puisse pas faire passer l'état
  existant pour le plan après travaux.
- Les actions `plan/*` actuelles (pièces, points, murs, ouvertures, obstacles, passages) agissent sur
  `site.existing`, puis `plan` est recalculé. L'éditeur actuel ne change pas.

### Dérivation (`planAfter`)

Repère du plan, millimètres ; booléens de `core/geometry/boolean`, arrondis au 1/100 mm.

1. **Démolitions d'abord.** La bande du mur sur l'intervalle (largeur = épaisseur du mur, prolongée de la tolérance du
   plan pour souder les deux pièces) est réunie aux pièces qu'elle touche : le mur disparaît, les pièces fusionnent.
   Les ouvertures de l'intervalle et les passages qui les utilisent disparaissent.
2. **Cloisons ensuite.** La bande de chaque cloison (rectangle `axe × épaisseur`, selon `align`, prolongé aux deux
   bouts pour mordre dans les murs) est retirée de la région des pièces. Une cloison qui ne traverse pas la pièce
   laisse une encoche ; un contour qui se referme autour d'un îlot donne un `Obstacle` (`kind: 'other'`).
3. **Morceaux** = composantes de la région obtenue. Un morceau de moins de 0,1 m² est ignoré (code `derive/sliver`).
4. **Provenance des arêtes.** Les booléens perdent l'origine des arêtes et suppriment les points colinéaires (donc
   seules les pièces touchées par un travail passent par eux). Chaque arête de sortie est rattachée à sa source par
   colinéarité (0,05 mm) :
   - arête d'un mur existant : le mur garde son `id`, son épaisseur et son `locked` ; coupé en plusieurs parties, la
     première (abscisse la plus petite) garde l'`id` (comme `plan/point/insert`), les suivantes prennent `<id>~2`,
     `<id>~3` ; ses ouvertures suivent la partie qui les contient (`offset` recalculé) ;
   - face de cloison : mur `<cloison>:a` ou `<cloison>:b` (suffixe `~k` s'il y a plusieurs parties dans le même
     morceau), `thickness` = épaisseur de la cloison, `of` renseigné ;
   - retour d'une démolition : mur `<démolition>:1` ou `:2`, épaisseur du mur démoli.
   Les pièces de part et d'autre d'une cloison sont donc en vis-à-vis à l'épaisseur de la cloison : `facingWalls`, les
   passages et la 3D fonctionnent sans changement.
5. **Ouvertures de cloison.** Chacune donne une porte sur chaque face (`<ouverture>:a`, `<ouverture>:b`, `offset` de la
   face b = `longueur − offset − largeur`) et un `Passage` `<ouverture>:p`, sauf si les deux faces sont dans le même
   morceau.

**Identité des pièces (sans mémoire).** L'ancre d'une pièce existante est son point d'étiquette (`labelPoint`), calculé
sur l'état existant : il ne dépend que de données enregistrées.
- Le morceau qui contient l'ancre garde l'`id`, l'`origin` (le contour reste dans le même repère : les `cuts`, `area` et
  `holes` des zones de sol restent valides), le nom et la hauteur.
- Plusieurs ancres dans un morceau (fusion) : la première pièce dans l'ordre du plan garde l'identité, les autres
  disparaissent.
- Morceau sans ancre : `id` = `<pièce d'origine>~<empreinte>`, l'empreinte (`core/hash`) portant sur les identifiants
  triés des cloisons et démolitions qui bordent le morceau ; la pièce d'origine est celle qui a le plus grand
  recouvrement. Nom « Séjour (2) », numéros dans l'ordre du coin haut gauche du morceau.
- Déplacer une cloison ne change aucun identifiant tant qu'elle ne franchit pas une ancre.

### Revêtements et pièces coupées ou fusionnées

Les zones restent dans le projet, pointent des identifiants de pièce et de mur, et sont rognées par la géométrie
(`zoneRegion`). La dérivation étant à la lecture, **rien n'est supprimé** :
1. le morceau qui garde l'identité garde ses zones et ses poses, rognées à son contour ;
2. les autres morceaux démarrent nus ; **aucune pose n'est copiée** (une pose sur deux pièces sans passage enfreindrait
   la règle d'étendue) ; « Continuer la pose » (`continuablePoses`) reste possible ;
3. une pièce ou un mur qui n'existe plus rend ses zones orphelines (`orphanZones`) : ignorées par les calculs,
   signalées, retirées seulement par l'action « Retirer » (`zone/prune`), jamais pendant un geste ;
4. supprimer la cloison ou la démolition (ou annuler) rétablit tout, puisque les zones n'ont pas bougé ;
5. avant de valider un tracé ou une démolition qui réduit la surface revêtue, l'interface liste par pose ce qui est
   perdu (« Carrelage, Pose 1 : −8,2 m² de sol ») avec `zoneArea` avant et après ; sans perte, pas de confirmation.

### Actions

- `plan/partition/add | update | remove`, `plan/partition/opening/add | update | remove`,
  `plan/demolition/add | update | remove` : réducteur pur `core/plan/works.ts`, aiguillé par le préfixe.
- Verrou : `plan/wall/update` avec `locked` (aucune action nouvelle). L'interface propose « Verrouiller les murs
  extérieurs » : les murs sans vis-à-vis (`facingWalls`), en un seul lot.
- `plan/point/remove` fusionne deux murs : le mur gardé est verrouillé si l'un des deux l'était.
- Pas d'action `split` ni `merge` : les pièces coupées ou fusionnées sont des conséquences de `site`. Les modules ne
  reçoivent rien de plus (les événements de pose existants suffisent).
- Un tracé de cloison et la découpe qui en résulte sont une seule action, donc une seule étape d'annulation. Le plan est recalculé après chaque
  action, y compris dans un `batch` (les actions suivantes lisent le plan à jour) ; sans travaux le coût est nul et, avec
  travaux, les groupes de pièces inchangés sont repris.

### Validation (`core/plan/works.ts`, codes ; le texte est écrit par l'interface)

`partition/too-short`, `partition/outside` (une extrémité hors des pièces), `partition/crosses-wall` (traverse un mur
existant non démoli), `partition/crosses-locked`, `partition/crosses-partition` (V1 : l'une doit s'arrêter sur
l'autre), `partition/crosses-obstacle`, `partition/over-opening` (alerte : l'extrémité tombe sur une fenêtre),
`partition/opening-size`, `partition/opening-outside`, `partition/opening-overlap`, `demolition/wall-missing`,
`demolition/locked`, `demolition/range`, `demolition/no-neighbour` (mur sans pièce en vis-à-vis),
`derive/sliver`, `derive/invalid-room` (le plan dérivé échoue à `validateRoom`), `derive/passage-lost` (alerte : un
passage ne relie plus deux portes qui se font face). Une ouverture existante coupée ou rognée par une cloison ou une
démolition garde un morceau dans chaque pièce (`<id>`, `<id>~2`) et lève `partition/over-opening`.

### Invariants testés

1. Sans travaux, `planAfter(site) === site.existing`.
2. Déterminisme : même `site` (même en changeant l'ordre des cloisons) → même plan, identifiants compris.
3. Aires : Σ pièces après travaux = Σ pièces existantes − Σ (bandes de cloison dans les pièces) + Σ (bandes démolies),
   à 0,1 % près.
4. `validatePlan(planAfter(site))` est vide quand `site` est valide ; tout passage dérivé passe `passageError`.
5. Un mur verrouillé garde son `id` et son `locked` dans le plan dérivé ; on ne peut pas le démolir.
6. Stabilité : déplacer une cloison sans franchir une ancre ne change aucun identifiant.
7. Retirer une cloison rétablit exactement le plan précédent (identifiants compris).

### Migration 3 → 4

`site = { existing: plan, partitions: [], demolitions: [] }`, `plan` retiré du document ; données des modules inchangées
(« sans changement pour le carrelage »). Base IndexedDB v6 : magasin `systems` (systèmes de cloison). **À corriger en
même temps** : l'étape v4 de `storage/db.ts` appelle `purge(tx, 'projects', PROJECT_SCHEMA)` avec la constante
vivante ; passer la constante à 4 supprimerait les projets v3. L'étape doit être figée à `3`. Les scénarios A/B
contiennent un projet : leur copie est migrée par la même étape (ne pas les supprimer). Premier usage de
`PROJECT_STEPS` ; test sur un document v3 figé.

### Impact et coût

Le contrat de module garde `plan` tel quel ; `coverage`, `poseHref` et `createPose` deviennent facultatifs (un module
sans pose, comme les cloisons, ne revêt aucune surface) et `ShoppingGroup` gagne `'structure'`. Les ~50 fichiers qui
lisent `project.plan` ne changent pas ; les fixtures de tests construisent un projet par une aide
(`projectFrom(plan)`). Estimation : modèle et dérivation 7 à 9 jours, éditeur 6 à 8 jours (`docs/PLAN.md` T0).

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

/** Données carrelage (C2) : réglages par pièce et par mur du plan ; la géométrie vient du plan. */
export interface CarrelageData {
  rooms: Record<Id, RoomTiling>;   // sol (FloorTiling) et murs (WallTiling) de chaque pièce
  settings: ProjectSettings;
  prices: Record<string, number>;
}
```
Détail : `docs/MODEL.md`. État au 2026-10-13 : le projet est en schéma 3 (zones et poses, `docs/NAVIGATION.md` §4) ;
le schéma 4 (plan v3, état existant et travaux) est décrit au §3 bis.

Scénarios A/B : le magasin `scenarios` appartient au module carrelage (types, lecture, écriture). Un autre
module pourra avoir ses propres scénarios plus tard.

IndexedDB : base `pilepoil`. Version 2 : magasin `boards` (bibliothèque de lames du parquet, index `name`,
`updatedAt`) ; version 3 : projets v1 (d'avant la boîte à outils) retirés, sans conversion. Les photos restent
communes.

## 5. Store et actions

- Actions préfixées : `plan/room/add`, `plan/room/update`, `plan/opening/add`…, `carrelage/zone/update`,
  `parquet/layout/update`…
- Le réducteur racine aiguille : `plan/*` vers `core/plan/reduce.ts`, `<module>/*` vers `module.reduce`.
- Historique annuler/rétablir unique au niveau du projet (mécanisme existant, `coalesceKey` conservé).
- Supprimer une pièce du plan : la racine retire ses zones et les poses restées sans zone, puis envoie
  `pose/removed` aux modules concernés (corrigé le 2026-10-13 : l'action `plan/room/removed` n'a jamais existé).

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
  group: 'covering' | 'underlay' | 'structure' | 'finish' | 'consumable' | 'tool';   // structure : ossature, plaques, isolant (cloisons)
  label: string;                     // « Stratifié chêne 1285 × 192 »
  quantity: number;                  // en unité de vente
  unit: 'pack' | 'box' | 'roll' | 'bar' | 'bag' | 'sachet' | 'tube' | 'cartridge' | 'litre'
      | 'piece' | 'm2' | 'm';                // sachet, cartridge, litre : unités actuelles du carrelage
  detail?: string;                   // « 49 lames + 5 % »
  unitPrice: number | null;
  priceFromLibrary?: boolean;        // prix suggéré par la bibliothèque, pas saisi dans le projet
  color?: string;                    // pastille (carreau, joint)
}
```
- Le carrelage convertit ses `ShoppingItem` actuels en `ShoppingLine` (adaptateur, sans toucher au calcul).
- Prix : chaque module garde ses prix ; l'écran Achats du projet les affiche et les modifie via le module.
- Écran « Achats » du projet : regroupé par magasin type (revêtements, sous-couches, finitions,
  consommables), total par module et total général, export PDF et CSV.

## 8. Navigation

```
Accueil (projets)
 ├─ Nouveau projet  #/new                 choix de l'outil : assistant (#/new/carrelage) ou projet vide + plan
 └─ Projet  #/p/:id                       cartes des modules activés + « Ajouter un outil », résumé, total
     ├─ Plan  #/p/:id/plan                éditeur de pièces commun
     ├─ Carrelage  #/p/:id/m/carrelage     pièces du plan, sol et murs à cocher ; /s/:surfaceId (éditeur),
     │                                     /room/:roomId (vue de la pièce), /results, /compare
     ├─ Parquet    #/p/:id/m/parquet       éditeur ; /results
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

Composants, moteur et résultats du carrelage, PWA, déploiement GitHub Pages.

Le design system n'est plus figé depuis le 2026-10-12 : l'identité PilePoil (`docs/IDENTITE.md`) le
remplace, parce que l'application a désormais un nom, un logo et une charte propres. Phase `phase/identite`.

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
| 2026-10-08 | Deux points d'entrée par module : `index.ts` (application) et `engine.ts` (moteur, worker) | §2 |
| 2026-10-08 | `ModuleEngine` : entrée et résultat propres à l'optimisation (`OptSpec`, `OptResult`) | §2 |
| 2026-10-08 | Booléens et décalage : `clipper2-ts` 2.0.1-18 (figée), enveloppée dans `core/geometry/boolean.ts` | §3 |
| 2026-10-08 | Migration v1 → v2 déterministe (ids de plan dérivés de l'id du projet) | §4 |
| 2026-10-08 | Workers et bibliothèques chargées tenus par la coquille ; résumés des cartes calculés en file | §6 |
| 2026-10-08 | Magasin `scenarios` : déplacé dans le module carrelage en S3 (avec le ramassage des photos) | §4 |
| 2026-10-08 | Achats : quantité = quantité sur laquelle porte le prix (m² pour un carreau), coût identique au carrelage | §7 |
| 2026-10-08 | Contrat : `priceAction` (prix modifiés par l'écran Achats via le module) | §2, §7 |
| 2026-10-08 | Parquet : règles par défaut selon le type de lame ; pose collée ou clouée = pas d'alerte de fractionnement ni de passage | `parquet/SPEC.md` §2 |
| 2026-10-08 | Icône Pilepoil : niveau à bulle ; redirection de l'ancienne adresse par un dépôt `calepinage-pwa` dédié | S3 |
| 2026-10-08 | Coquille indépendante du carrelage dès S3 (contrat : `start`, `usedPhotos`, `screens.create/card/settings`) | §2 |
| 2026-10-08 | Bibliothèques tenues par la coquille ; parquet créé avec sa seule bibliothèque de lames avant P1 | §2, S3 |
| 2026-10-08 | Éditeur de plan en SVG ; activer un module = action `project/module/add` (données créées hors réducteur) | §5, §9 |
| 2026-10-08 | Murs avec identifiant stable et épaisseur propre ; ouvertures rattachées à l'`id` du mur | §3 |
| 2026-10-08 | Épaisseur de mur par défaut : 72 mm (cloison placo 72/48, BA13) | §3, §4 |
| 2026-10-08 | Magasin `scenarios` géré par le module carrelage | §4 |
| 2026-10-08 | Renommage complet : base `pilepoil` avec copie depuis `calepinage`, manifeste et dépôt renommés | §4, PLAN S3 |
| 2026-10-08 | Unités d'achat communes étendues à `sachet`, `cartridge`, `litre` | §7 |
| 2026-10-08 | Parquet : contours envoyés au moteur dans le repère du plan, modèles types de lames, marge qui suit le motif, paquets comptés en lames | `parquet/SPEC.md` |
| 2026-10-09 | Nouveau projet : choix de l'outil à `#/new` ; un outil sans assistant crée un projet vide et ouvre le plan | §2, §8 |
| 2026-10-09 | Base 3D commune `src/render/scene3d` et vue `ui/components/Scene3DView`, extraites du carrelage (rendu inchangé) | P5 |
| 2026-10-09 | Base PDF commune `src/ui/lib/pdf/doc.ts` et découpe de barres `src/core/cutting/bars.ts` | P4 |
| 2026-10-09 | Carrelage bâti sur le plan commun : sols et murs du plan, un mur = une surface, pas de conversion des anciens projets, parité du moteur sur les rectangles | `PLAN.md` C1–C4 |
| 2026-10-09 | `shopping` reçoit le plan du projet (le carrelage y retrouve ses surfaces) ; données carrelage par pièce et mur du plan (schéma 2), scénarios en schéma 3, anciens supprimés | §2, `PLAN.md` C2 |
| 2026-10-09 | Carrelage : écran d'accueil par pièce du plan, assistant qui dessine la pièce (rectangle, L, U), vue de la pièce depuis le polygone | §8, `PLAN.md` C3 |
| 2026-10-09 | Nettoyage : import de l'ancienne appli, copie de la base `calepinage`, migration des projets v1 et anciennes adresses retirés ; base v3 ; `legacy/` reste la référence de parité du moteur | §4, `PLAN.md` C4 |
| 2026-10-09 | Parcours centré sur le projet : zones et poses dans le projet, carrelage et parquet de la même manière, résultats par surface, pièce et projet, assistant carrelage retiré, pas de conversion | `NAVIGATION.md`, `PLAN.md` N0–N5 |
| 2026-10-09 | N1 : zones (surface coupée par des lignes) et poses dans le projet (v3, base v4 sans conversion), règles dans `core/coverage`, réglages des modules par pose (carrelage schéma 3, parquet schéma 4) ; pose de carrelage limitée à une surface jusqu'à N2 ; « bande » pour l'ancienne zone du carrelage ; limites de zone du parquet par pièce dans le moteur | `NAVIGATION.md` §4, `PLAN.md` N1 |
| 2026-10-09 | N2 : nouveau projet par le plan (projet enregistré avec sa première pièce, revêtements après le plan) ; poses de carrelage continues (sols reliés, murs qui se suivent, hauteur carrelée par mur), étendue `continuous` ; continuer une pose voisine par une fenêtre de choix | `NAVIGATION.md` §5–6, `PLAN.md` N2 |
| 2026-10-12 | N3 : vue globale et écran Pièce communs (revêtir, continuer, découper, changer de revêtement, retirer en séparant la pose) ; contrat `poseHref` ; écran Carrelage remplacé ; épaisseur des murs par défaut (Réglages) et par pièce, tableaux à l'épaisseur du mur ; pièce contre une autre et porte vers la voisine (`core/plan/neighbors`) | `NAVIGATION.md` §3–6, `PLAN.md` N3 |
| 2026-10-12 | N5, premier chargement : contrat scindé en manifeste (identité, écrans, bibliothèque, migrations, chargé au démarrage) et `logic()` (réducteur, entrée moteur, achats, chargée à la demande, attendue par `loadModules()` avant tout écran de projet) ; écrans Projet, Réglages, Démo chargés à la demande ; jsPDF et l'aide de préchargement de Vite séparés (`build.rolldownOptions.output.advancedChunks`) : jsPDF n'est plus téléchargé au démarrage ; service worker enregistré après `load`. Démarrage 87 → 38 ko gzip | §2 |
| 2026-10-12 | N5 : écran Résultats commun à trois niveaux (pose, pièce, projet) au lieu des résultats par module ; contrat `results` (rapport, section, PDF, 3D) ; enveloppe 3D commune (murs nus pleine hauteur, embrasures, sol brut), murs bas du parquet retirés ; prix modifiables seulement sur l'écran Achats ; dossier du projet en PDF (plan d'ensemble, résumé par pièce, poses, achats) ; anciennes adresses `m/<module>/results` redirigées | `NAVIGATION.md` §5, §7, `PLAN.md` N5 |
| 2026-10-12 | Vue 3D du projet (`#/p/:id/3d`) façon maison de poupée : murs en volume, pleins / bas / coupés côté caméra (coupe dans le shader de la scène, tranche charbon, ombres cohérentes) ; murs repérés par la scène d'après la géométrie (`tagWalls`), sans changement du contrat des modules ; `MeshData` reçoit `opacity` et `wallNormals`, facultatifs, remplis par la coquille ; menuiseries, terrain, pièce touchée ; aperçu sur l'écran Projet ; maquette commune `ui/lib/model3d.ts` | `NAVIGATION.md` §5 |
| 2026-10-12 | Identité PilePoil (« Vos travaux, au millimètre près. ») : palette pétrole / terracotta / ocre / sauge / ivoire / charbon, Manrope et Inter, logo, icônes et PWA de `src/ui/design/identite/` ; remplace la règle « le design system ne change pas » et l'icône niveau à bulle ; anciens noms de variables gardés en alias pendant la transition ; statuts de coupe aux couleurs de la palette | §10, `UX.md`, `IDENTITE.md` |
| 2026-10-12 | N4 : coquille commune du calepinage (`ui/calepinage`, étapes Produit, Pose, Découpage, Finitions, Avancé en onglets) pour le carrelage et le parquet ; poses du parquet créées et retirées sur l'écran Pièce ; zones avec contour (`area`, `holes`), découpe d'un sol par un polygone aimanté ; tests de durée isolés (projet vitest `perf`) | `NAVIGATION.md` §5–6, `PLAN.md` N4, `parquet/SPEC.md` §3 |
| 2026-10-13 | Module peinture : murs seulement, plafond en phase séparée (PE5) ; ouvertures déduites au-dessus d'un seuil réglable (1 m² par défaut) ; apprêt, enduit, boiseries, consommables ; pots en combinaison optimale ; `ShoppingUnit` gagne `pot` | `peinture/SPEC.md`, `PLAN.md` PE0–PE5 |
| 2026-10-13 | PE2 : module peinture caché des menus (`hidden`) jusqu'à PE3 ; prix saisis au niveau du module ; besoins additionnés avant le choix des pots ; base v5 (magasin `paints`) | `peinture/SPEC.md`, `PLAN.md` PE2 |
| 2026-10-13 | PE3 : éditeur de peinture dans la coquille commune ; murs et zones se modifient sur l'écran Pièce ; `poseLabel` du manifeste ; module visible, drapeau `hidden` retiré | `PLAN.md` PE3 |
| 2026-10-13 | PE4 : peinture en 3D par une couche de 2 mm devant le plâtre (`overlay` des exports de résultats : l'enveloppe n'est pas retirée sous le module) ; PDF de la peinture par pose, pièce et projet | `PLAN.md` PE4 |
| 2026-10-13 | Plan v3 : `Site` = état existant (murs `locked`) + cloisons + démolitions, enregistré ; `project.plan` (après travaux) calculé par `planAfter` à chaque changement et au chargement, jamais enregistré ; les lecteurs de pièces ne changent pas. Raison : relever l'existant puis chiffrer des cloisons sans perdre l'état d'origine ni les revêtements | §3 bis |
| 2026-10-13 | Identité des pièces dérivées sans mémoire (ancre = point d'étiquette de l'état existant) ; pièce coupée : le morceau gardien garde ses zones, les autres démarrent nus, rien n'est copié ni supprimé (zones orphelines, réversible), perte confirmée avant validation | §3 bis |
| 2026-10-13 | Migration 3 → 4 sans changement pour les modules ; étape de purge v4 de la base figée à 3 ; base v6 (`systems`) | §3 bis |
| 2026-10-13 | Module cloisons : `coverage`, `poseHref`, `createPose` facultatifs ; groupe d'achat `structure` ; phases T0, CL1 à CL3 (C1 à C4 sont déjà le carrelage) ; `core/cutting/bars.ts` existe depuis P4 et sert tel quel | `cloisons/SPEC.md`, `PLAN.md` |
| 2026-10-13 | CL2 : le module cloisons est activé par la première cloison tracée (`project/module/add` dans la même étape) ; ses réglages sont par cloison du plan et communs au projet ; bibliothèque `systems` (base v6), prix saisis dans le projet ; l'écran Projet range les outils sans pose sous « Travaux » | `cloisons/SPEC.md`, `PLAN.md` CL2 |
| 2026-10-13 | CL3 : un module sans pose a ses résultats aux niveaux projet et pièce de l'écran Résultats commun ; `PoseReport` gagne `title`, `where`, `href` (objet décrit par le module : une cloison) ; élévation partagée écran / PDF | `cloisons/SPEC.md` §8, `PLAN.md` CL3 |
| 2026-10-15 | Mode chantier du parquet retiré (écran, route `chantier`, `ModuleScreens.worksite`, champ `worksite` et actions `parquet/worksite/*`) ; les anciens documents gardent un champ `worksite` ignoré, sans migration | `PLAN.md` P5 |
| 2026-10-15 | F1 : un produit de bibliothèque utilisé par un projet ne se supprime pas (`LibraryDefinition.usedIn`) ; un produit choisi absent est signalé par le moteur (peinture `product-missing`, cloisons `system-missing`), jamais remplacé en silence | `PLAN.md` F1 |
| 2026-10-15 | F1 : un calcul qui échoue garde le résultat d'avant et le dit (`ComputeFailed`) ; chaque erreur de `toSpec` a un texte (`ModuleResults.errorText`) | `PLAN.md` F1 |
| 2026-10-15 | F1 : les modules se lisent par la coquille, jamais par import : `wallBases` (pied des murs) rassemblé par `projectContext` et passé à `toSpec` ; la peinture retire la bande des plinthes et ne peint que les plinthes peignables (réglage manuel si le sol n'est pas revêtu), le parquet ne pose pas de plinthe le long d'un mur carrelé depuis le sol | `peinture/SPEC.md` §3, §7 |
| 2026-10-15 | F1 : marges en fraction partout (parquet schéma 5, migration de `marginPct`) ; lignes d'achat du carrelage préfixées `carrelage:` (prix rangés sous la clé du moteur, sans migration, parité intacte) ; carreaux types en bibliothèque ; `SYSTEM_SCHEMA` des cloisons | `parquet/SPEC.md` §2 |
