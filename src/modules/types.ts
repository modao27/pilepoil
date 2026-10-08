/**
 * Contrat d'un module de la boîte à outils (docs/BOITE.md §2).
 * Deux faces : le moteur (pur, exécuté dans le worker) et l'application (état, écrans).
 * Ce fichier ne contient que des types : le worker peut l'importer sans rien charger.
 */
import type { Component, Snippet } from 'svelte';

import type { Plan } from '../core/plan/types';
import type { ShoppingLine } from '../core/shopping/types';
import type { Id, Project } from '../state/model';

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
   * Réservés : '' (éditeur), 'results', 'chantier'.
   */
  path: string;
  load: ScreenLoader;
}

export interface ModuleScreens {
  /** #/p/:id/m/<module> */
  editor: ScreenLoader;
  /** #/p/:id/m/<module>/results */
  results: ScreenLoader;
  /** #/p/:id/m/<module>/chantier — mode chantier. */
  worksite?: ScreenLoader;
  /** Autres écrans du module (pièce 3D, comparaison…). */
  routes?: ModuleRoute[];
}

/** Face application : état, sélecteurs, écrans. */
export interface ToolModule<
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
  /** Tracé SVG 34 × 24, trait fin. */
  icon: string;
  schemaVersion: number;
  /** Données initiales quand on active le module sur un projet. */
  create(plan: Plan): Data;
  /** Réducteur pur des actions du module ; renvoie `data` inchangé si rien ne change. */
  reduce(data: Data, action: Action, plan: Plan): Data;
  /** État → entrée moteur. Renvoie les erreurs bloquantes sans lever d'exception. */
  toSpec(project: Project, libraries: Libraries): { spec: Spec } | { errors: ModuleError[] };
  /** Lignes d'achat consolidables. */
  shopping(result: Result, data: Data, libraries: Libraries): ShoppingLine[];
  /** Action qui fixe le prix unitaire d'une ligne (`key`) ; null : revenir au prix de la bibliothèque. */
  priceAction(key: string, value: number | null): Action;
  /** Résumé court pour la carte du module (« 46 carreaux, 312 € »). */
  summary(result: Result): ModuleSummary;
  /** Migrations des données du module : migrations[n] passe de la version n - 1 à n. */
  migrations: Record<number, (doc: unknown) => unknown>;
  /** Écrans, chargés à la demande. */
  screens: ModuleScreens;
  /** Bibliothèque de produits propre au module (carreaux, lames…). Facultatif. */
  library?: LibraryDefinition;
}
