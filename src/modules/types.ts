/**
 * Contrat d'un module de la boîte à outils (docs/BOITE.md §2).
 * Deux faces : le moteur (pur, exécuté dans le worker) et l'application (état, écrans).
 * Ce fichier ne contient que des types : le worker peut l'importer sans rien charger.
 */
import type { Component, Snippet } from 'svelte';

import type { ResultScope } from '../core/coverage/scope';
import type { CoverageRules } from '../core/coverage/types';
import type { Plan } from '../core/plan/types';
import type { MeshData } from '../render/scene3d/types';
import type { ShoppingLine } from '../core/shopping/types';
import type { Id, Project } from '../state/model';
import type { Db } from '../storage/db';
import type { Doc } from '../ui/lib/pdf/doc';

export type { ResultScope };

/** 'carrelage', 'parquet'… Liste ouverte : ajouter un module ne touche pas aux types communs. */
export type ModuleId = string;

/* ------------------------------------------------------------------ moteur */

/** Ce que le worker fournit au moteur. Rien ici ne doit influencer le résultat d'un calcul. */
export interface EngineContext {
  /** Horloge monotone en ms, pour mesurer (jamais pour décider). */
  now(): number;
}

/** Avancement d'un calcul long, envoyé à chaque tranche. */
export interface Progress {
  /** Avancement de 0 à 100 (de la partie en cours si `part` est donné). */
  percent: number;
  /** Index de la partie en cours (zone du carrelage, pièce du parquet…). */
  part?: number;
}

/**
 * Face moteur : exportée par `modules/<id>/engine.ts`, importée seulement par `modules/engines.ts`
 * (le worker), sans DOM ni Svelte. L'optimisation peut avoir sa propre entrée et son propre résultat
 * (carrelage : une surface et des zones, pas le projet entier).
 */
export interface ModuleEngine<Spec, Result, OptSpec = Spec, OptResult = Result> {
  id: ModuleId;
  /** Calcul complet ; doit être déterministe pour une même entrée. */
  compute(spec: Spec, ctx: EngineContext): Result;
  /** Calcul long découpé en tranches (optimisation), annulable par `return()`. Facultatif. */
  optimize?(spec: OptSpec, ctx: EngineContext): Generator<Progress, OptResult, void>;
}

/* ------------------------------------------------------------ application */

/** Action propre à un module, préfixée par son identifiant : 'carrelage/zone/update'. */
export interface ModuleAction {
  type: `${ModuleId}/${string}`;
}

/** Erreur bloquante renvoyée par `toSpec` : un code, le texte est produit par l'interface du module. */
export interface ModuleError {
  code: string;
  /** Élément concerné (surface, pièce…), pour y emmener l'utilisateur. */
  ref?: Id;
  /** Valeurs à insérer dans le message. */
  params?: Record<string, string | number>;
}

/** Envoyé par le projet au module d'une pose : ses réglages arrivent avec elle, partent avec elle. */
export type PoseEvent = { type: 'pose/added'; poseId: Id; settings: unknown } | { type: 'pose/removed'; poseId: Id };

/** Résumé court pour la carte du module sur l'écran Projet. */
export interface ModuleSummary {
  /** « 46 carreaux, 12,4 m² ». */
  text: string;
  /** Nombre d'alertes à signaler sur la carte (0 = aucune). */
  alerts: number;
}

/** Élément d'une bibliothèque de produits (carreau, lame…). */
export interface LibraryItem {
  id: Id;
  name: string;
  updatedAt: number;
  /** Photo du produit (magasin photos commun), pour le ramassage des photos orphelines. */
  photoId?: Id | null;
}

/** Bibliothèques chargées, par identifiant de bibliothèque ('tiles', 'boards'…). */
export type Libraries = Readonly<Record<string, readonly LibraryItem[]>>;

/** Bibliothèque de produits propre à un module, sous #/library/<id>. */
export interface LibraryDefinition {
  /** 'tiles', 'boards' : segment de route et clé dans `Libraries`. */
  id: string;
  /** « Carreaux ». */
  label: string;
  /** Magasin IndexedDB. */
  store: string;
  schemaVersion: number;
  migrations: Record<number, (doc: unknown) => unknown>;
  screens: {
    /** #/library/<id> */
    list: ScreenLoader<LibraryScreenProps>;
    /** #/library/<id>/<itemId> et #/library/<id>/new */
    edit: ScreenLoader<LibraryScreenProps>;
  };
  /** Modèles types posés une seule fois dans la bibliothèque (un modèle supprimé ne revient pas). */
  templates?: () => LibraryItem[];
}

/** Props passées aux écrans d'un module, sous #/p/:id/m/<module>/… */
export interface ModuleScreenProps {
  projectId: Id;
  /** Paramètres de la route (`:surfaceId` → `params.surfaceId`). */
  params: Record<string, string>;
}

export interface LibraryScreenProps {
  /** null : écran de liste, ou création d'un nouvel élément. */
  itemId: Id | null;
  /** Onglets des bibliothèques, fournis par la coquille (écran de liste). */
  nav?: Snippet;
}

/** Écran chargé à la demande (import dynamique, découpé par Vite). */
export type ScreenLoader<Props extends object = ModuleScreenProps> = () => Promise<Component<Props>>;

/** Écran propre au module, en plus des écrans standard. */
export interface ModuleRoute {
  /**
   * Chemin sous #/p/:id/m/<module>/, sans barre initiale ni finale.
   * Segments fixes ou paramètres `:nom` : 'room', 's/:surfaceId'.
   * Réservés : '' (éditeur), 'results' (ancienne adresse des résultats), 'chantier'.
   */
  path: string;
  load: ScreenLoader;
}

export interface ModuleScreens {
  /** #/p/:id/m/<module> */
  editor: ScreenLoader;
  /** #/p/:id/m/<module>/chantier — mode chantier. */
  worksite?: ScreenLoader;
  /** Autres écrans du module (pièce 3D, comparaison…). */
  routes?: ModuleRoute[];
  /** #/new : assistant de création d'un projet avec cet outil. */
  create?: ScreenLoader<Record<string, never>>;
  /** Carte d'un projet sur l'accueil (vignette, chiffres), si le projet a cet outil. */
  card?: ScreenLoader<{ project: Project }>;
  /** Section du module dans les Réglages (données, import…). */
  settings?: ScreenLoader<Record<string, never>>;
}

/* -------------------------------------------------------------- résultats */

/** Ce que reçoit un module pour parler d'une portée : le projet, ses bibliothèques, son dernier résultat. */
export interface ResultInput<Result = unknown> {
  project: Project;
  libraries: Libraries;
  result: Result;
  scope: ResultScope;
}

/** Chiffre d'une pose sur une portée : « Carreaux posés : 46 ». */
export interface ReportFigure {
  label: string;
  value: string;
  /** Teinte de la carte (statuts de coupe du design system). */
  status?: 'cut' | 'reuse' | 'thin';
}

/**
 * Ce qu'un module dit d'une de ses poses sur une portée (docs/NAVIGATION.md §7). Les pièces posées et leurs
 * coupes sont exactes sur la portée ; les quantités à commander sont celles du calcul (`orderNote` dit lesquelles
 * quand elles dépassent la portée), jamais inventées pour une partie.
 */
export interface PoseReport {
  pose: Id;
  figures: ReportFigure[];
  /** Quantités à commander : « 52 carreaux 60 × 30 cm (3 cartons) ». */
  order: string[];
  /** « Pour toute la pose » ou « pour tout le projet (chutes partagées) » ; null : celles de la portée. */
  orderNote: string | null;
  /** Alertes, texte produit par l'interface du module. */
  alerts: string[];
  /** false : la pose ne se calcule pas (erreur dans `alerts`). */
  ok: boolean;
}

/** Props de la section d'un module sur l'écran Résultats commun. */
export interface ResultSectionProps {
  project: Project;
  scope: ResultScope;
  /** Résultat du module (son type à lui). */
  result: unknown;
}

/** Fonctions lourdes des résultats, chargées à la demande (PDF, 3D). */
export interface ResultExports<Result = unknown> {
  /**
   * true : les maillages se posent sur l'enveloppe des pièces sans la remplacer (peinture) ; le plâtre des murs
   * du module reste dessiné par l'enveloppe.
   */
  overlay?: boolean;
  /** Ajoute au document les pages du module pour la portée : plans cotés, découpe… (pas la liste d'achat). */
  pdf(doc: Doc, input: ResultInput<Result>): void;
  /**
   * Maillages des revêtements du module dans la portée (repère du plan, mètres), sans l'enveloppe des pièces
   * (sol brut, murs nus : `render/scene3d/envelope`). Les murs revêtus, plâtre compris, sont dessinés par le
   * module.
   */
  meshes(input: ResultInput<Result>): MeshData[];
}

/** Résultats d'un module aux trois niveaux : pose, pièce, projet (docs/NAVIGATION.md §7). */
export interface ModuleResults<Result = unknown> {
  /** Un rapport par pose du module touchée par la portée, dans l'ordre du projet. Léger, sans DOM. */
  report(input: ResultInput<Result>): PoseReport[];
  /** Détail du module sur l'écran Résultats (commande, plan, découpe…). */
  section: ScreenLoader<ResultSectionProps>;
  exports(): Promise<ResultExports<Result>>;
}

/**
 * Logique d'un module : réducteur, entrée moteur, achats. Chargée à la demande (`ModuleManifest.logic`), hors du
 * premier chargement de l'application ; la coquille l'attend par `loadModules()` avant d'ouvrir un projet.
 */
export interface ModuleLogic<
  Data = unknown,
  Spec = unknown,
  Result = unknown,
  Action extends ModuleAction = ModuleAction,
> {
  /** Données initiales quand on active le module sur un projet (sans pose : les poses naissent des zones). */
  create(plan: Plan): Data;
  /** Réglages d'une nouvelle pose ; `like` : pose dont on reprend les réglages. */
  createPose?(project: Project, libraries: Libraries, like?: Id): unknown;
  /**
   * Réducteur pur des actions du module et des événements de pose (réglages ajoutés avec une pose, retirés avec
   * elle) ; renvoie `data` inchangé si rien ne change.
   */
  reduce(data: Data, action: Action | PoseEvent, plan: Plan): Data;
  /** État → entrée moteur. Renvoie les erreurs bloquantes sans lever d'exception. */
  toSpec(project: Project, libraries: Libraries): { spec: Spec } | { errors: ModuleError[] };
  /** Lignes d'achat consolidables ; `project` : le projet calculé (plan, zones, poses). */
  shopping(result: Result, data: Data, libraries: Libraries, project: Project): ShoppingLine[];
  /** Action qui fixe le prix unitaire d'une ligne (`key`) ; null : revenir au prix de la bibliothèque. */
  priceAction(key: string, value: number | null): Action;
  /** Résumé court pour la carte du module (« 46 carreaux, 312 € »). */
  summary(result: Result): ModuleSummary;
}

/** Ce que la coquille sait d'un module dès le démarrage : identité, écrans, bibliothèque, migrations. */
export interface ModuleManifest<
  Data = unknown,
  Spec = unknown,
  Result = unknown,
  Action extends ModuleAction = ModuleAction,
> {
  id: ModuleId;
  /** « Carrelage ». */
  label: string;
  /** Une phrase pour l'accueil du projet. */
  description: string;
  /** Contenu SVG 34 × 24, trait 1,5 (icônes de module de l'identité). */
  icon: string;
  schemaVersion: number;
  /** Bouton de l'écran Pièce qui ouvre la pose (« Calepinage » par défaut). */
  poseLabel?: string;
  /**
   * Surfaces acceptées et étendue d'une pose (docs/NAVIGATION.md §4). Absent : le module ne revêt aucune surface
   * (cloisons) ; il n'a ni pose, ni `poseHref`, ni `createPose`.
   */
  coverage?: CoverageRules;
  /** Adresse de l'éditeur (calepinage) d'une pose du module : la coquille y mène sans connaître ses écrans. */
  poseHref?(projectId: Id, poseId: Id): string;
  /** Logique du module (réducteur, entrée moteur, achats), chargée à la demande. */
  logic(): Promise<ModuleLogic<Data, Spec, Result, Action>>;
  /** Résultats par pose, pièce et projet : chiffres, détail, PDF, 3D (chargés à la demande). */
  results(): Promise<ModuleResults<Result>>;
  /** Migrations des données du module : migrations[n] passe de la version n - 1 à n. */
  migrations: Record<number, (doc: unknown) => unknown>;
  /** Écrans, chargés à la demande. */
  screens: ModuleScreens;
  /** Démarrage, base ouverte, avant le chargement des projets (import de données…). Facultatif. */
  start?(db: Db): Promise<void>;
  /** Photos utilisées hors des bibliothèques (scénarios…), gardées au ramassage. Facultatif. */
  usedPhotos?(db: Db): Promise<Id[]>;
  /** Bibliothèque de produits propre au module (carreaux, lames…). Facultatif. */
  library?: LibraryDefinition;
}

/**
 * Module vu par la coquille via le registre : son manifeste et sa logique. La logique n'est utilisable qu'une
 * fois `loadModules()` résolu (modules/registry.ts) ; avant, ses fonctions lèvent une erreur.
 */
export type ToolModule<
  Data = unknown,
  Spec = unknown,
  Result = unknown,
  Action extends ModuleAction = ModuleAction,
> = ModuleManifest<Data, Spec, Result, Action> & ModuleLogic<Data, Spec, Result, Action>;
