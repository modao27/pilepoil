/**
 * Types du moteur peinture (docs/peinture/SPEC.md §2). Millimètres pour les longueurs, millilitres pour les
 * volumes (grammes pour un enduit), m² pour les surfaces des résultats. JSON simple : passe par le worker.
 */
import type { Polygon } from '../../../core/geometry/types';
import type { Id } from '../../../core/plan/types';

export type PaintRole = 'finish' | 'primer' | 'filler';
export type PaintSheen = 'mat' | 'satin' | 'gloss';
/** Ancien peint, plâtre ou placo neuf, béton ou crépi. */
export type Support = 'painted' | 'plaster' | 'concrete';
/** État du support, pour l'enduit. */
export type SupportState = 'good' | 'average' | 'poor';
export type Tint = 'light' | 'medium' | 'dark';
export type PaintUse = 'walls' | 'woodwork' | 'humid';

export interface PaintPack {
  /** Contenance en litres (kg pour un enduit). */
  size: number;
  price: number | null;
}

/** Ce que le moteur lit d'un produit de la bibliothèque `paints` (voir `Paint`, paint.ts). */
export interface SpecPaint {
  id: Id;
  name: string;
  role: PaintRole;
  tint?: Tint;
  uses: PaintUse[];
  /** Rendement par couche, m² par litre (par kg pour un enduit). */
  yield: number;
  /** Couches conseillées par le fabricant. */
  coats: number;
  packs: PaintPack[];
}

export interface OpeningRule {
  mode: 'all' | 'threshold' | 'none';
  /** Surface au-delà de laquelle une ouverture est déduite (mode `threshold`), mm². */
  threshold: number;
}

export interface WoodworkSettings {
  skirting: boolean;
  /** mm. */
  skirtingHeight: number;
  frames: boolean;
  /** Largeur de chambranle, mm. */
  frameWidth: number;
  doors: boolean;
  doorFaces: 1 | 2;
  finish: Id | null;
  coats: number;
  primer: Id | null;
}

export interface Consumables {
  masking: boolean;
  sheet: boolean;
  roller: boolean;
  brush: boolean;
}

/** Réglages d'une pose de peinture. */
export interface PaintPoseSettings {
  finish: Id | null;
  coats: number;
  primer: Id | null;
  filler: Id | null;
  fillerState: SupportState;
  support: Support;
  /** Perte de chantier, fraction (0,10 = 10 %). */
  margin: number;
  openings: OpeningRule;
  woodwork: WoodworkSettings;
  consumables: Consumables;
}

export interface SpecOpening {
  id: Id;
  kind: 'door' | 'french-window' | 'window';
  /** Depuis le début du mur. */
  offset: number;
  width: number;
  /** 0 pour une porte. */
  sill: number;
  height: number;
}

/** Une zone de mur de la pose, dans le repère du mur (x le long du mur, y depuis le sol vers le haut). */
export interface SpecZone {
  id: Id;
  room: Id;
  wall: Id;
  /** Région de la zone (coupes, contours et trous déjà appliqués) ; ouvertures non retirées. */
  region: Polygon[];
  /** Ouvertures du mur. */
  openings: SpecOpening[];
}

export interface PaintSpec {
  zones: SpecZone[];
  /** Longueur de chaque mur touché, mm (masquage). */
  wallLengths: Record<Id, number>;
  /** Surface au sol des pièces touchées, mm² (bâche). */
  floorArea: number;
  /** Produits utilisés par les réglages, par identifiant. */
  paints: Record<Id, SpecPaint>;
  /** Prix saisis dans le projet, par clé de ligne d'achat (`peinture:consumable:<id>`…). */
  prices: Record<string, number>;
  settings: PaintPoseSettings;
}

export type PaintAlertCode =
  | 'no-product'
  | 'product-missing'
  | 'missing-yield'
  | 'no-pack'
  | 'no-surface'
  | 'dark-tint-coat'
  | 'primer-missing'
  | 'product-use-mismatch'
  | 'opening-overlap';

export type PaintTarget = 'walls' | 'woodwork';

export interface PaintAlert {
  code: PaintAlertCode;
  paint?: Id;
  target?: PaintTarget;
  /** `product-missing` : rôle du produit choisi qui n'est plus dans la bibliothèque. */
  role?: PaintRole;
}

export interface PackCount {
  /** Contenance du pot, litres (kg pour un enduit). */
  size: number;
  count: number;
  price: number | null;
}

export interface PaintProduct {
  /** Stable : `${target}:${role}`. */
  key: string;
  paint: Id;
  role: PaintRole;
  target: PaintTarget;
  /** Surface traitée, m². */
  surface: number;
  coats: number;
  /** Besoin avec marge : mL (g pour un enduit). */
  need: number;
  packs: PackCount[];
  /** Total acheté, mL (g). */
  purchased: number;
  /** purchased − need. */
  surplus: number;
  cost: number | null;
}

export interface ConsumableLine {
  id: keyof Consumables;
  quantity: number;
  unitPrice: number | null;
}

/** Surface d'une zone de mur de la pose, m². */
export interface ZoneArea {
  id: Id;
  room: Id;
  wall: Id;
  gross: number;
  openings: number;
  net: number;
}

export interface PaintResult {
  /** m². */
  areas: { gross: number; openings: number; net: number };
  /** Surface de chaque zone de la pose (résultats par pièce). */
  zones: ZoneArea[];
  woodwork: { skirtingLength: number; skirting: number; frames: number; doors: number; total: number };
  products: PaintProduct[];
  consumables: ConsumableLine[];
  /** Somme des produits et des consommables chiffrés ; null si un produit n'a pas de prix. */
  cost: number | null;
  alerts: PaintAlert[];
}

/** Entrée du moteur peinture : une entrée par pose de peinture du projet. */
export interface PeintureSpec {
  poses: { id: Id; spec: PaintSpec }[];
}

export interface PeintureResult {
  poses: { id: Id; result: PaintResult }[];
}
