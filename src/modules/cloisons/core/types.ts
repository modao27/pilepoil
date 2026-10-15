/**
 * Types du moteur des cloisons (docs/cloisons/SPEC.md §2 et §3). mm, m² en sortie ; JSON simple (passe par le worker).
 * Le moteur est 1D par cloison : il ne voit pas le plan, `toSpec` (CL2) construit chaque cloison dans son repère
 * (x le long de l'axe depuis le départ, y depuis le sol).
 */

/** Version des systèmes de la bibliothèque `systems`. */
export const SYSTEM_SCHEMA = 1;
import type { BarsResult } from '../../../core/cutting/bars';

export type Id = string;

/* ------------------------------------------------------------------ données */

/** Système de cloison de la bibliothèque `systems` (« 72/48 »). */
export interface PartitionSystem {
  schemaVersion: typeof SYSTEM_SCHEMA;
  id: Id;
  name: string;
  /** Épaisseur finie nominale. */
  thickness: number;
  /** Profondeur de l'ossature (montants et rails). */
  studWidth: number;
  /** Couches de plaque par face. */
  layers: 1 | 2;
  plateThickness: number;
  createdAt: number;
  updatedAt: number;
}

export type PlateType = 'standard' | 'hydro' | 'phonic' | 'fire';
export type InsulationKind = 'glass-wool' | 'rock-wool' | 'wood-fibre';
export interface Insulation {
  kind: InsulationKind;
}

export interface Reinforcement {
  /** Montant de départ contre un mur ou une cloison. */
  ends: 'single' | 'double';
  /** Montants de baie : toujours doublés. */
  jambs: 'double';
  /** Liaison en T et angle. */
  junctions: 'single' | 'double';
  /** Renfort bois dans les montants de baie. */
  woodInsert: boolean;
}

/** Face a : côté de la normale (dy, −dx) de l'axe ; face b : l'autre. */
export type Face = 'a' | 'b';

export interface PlateFormat {
  length: number;
  width: number;
}

export interface ConsumableRatios {
  /** Vis 25 mm, 1re couche : par m² de plaque. */
  screw25: { perM2: number; pack: number };
  /** Vis 35 mm, couches suivantes. */
  screw35: { perM2: number; pack: number };
  /** Bande à joint : mètres par m² de plaque ; pack = mètres d'un rouleau. */
  jointTape: { perM2: number; pack: number };
  /** Enduit à joint : kg par m² de plaque ; pack = kg d'un sac. */
  jointCompound: { kgPerM2: number; pack: number };
  /** Bande résiliente sous rails et montants de départ ; pack = mètres d'un rouleau. */
  resilientStrip: { pack: number };
  /** Fixation des rails et montants de départ : tous les `spacing` mm, plus une ; pack = pièces d'une boîte. */
  fixing: { spacing: number; pack: number };
  /** Cornière ; pack = mètres d'une barre. */
  cornerBead: { pack: number };
  /** Renfort bois (tasseau) ; pack = mètres vendus à l'unité. */
  woodInsert: { pack: number };
}

export interface HeightRule {
  /** Nom du système (« 72/48 »). */
  system: string;
  spacing: 600 | 400;
  /** mm ; null : inconnu. */
  max: number | null;
  /** false : « à vérifier » (docs/cloisons/SPEC.md §2.4). */
  verified: boolean;
  source: string;
}

export interface CloisonsSettings {
  maxHeights: HeightRule[];
  plateFormats: PlateFormat[];
  /** Longueurs de montants vendues, mm. */
  studLengths: number[];
  railBar: number;
  /** Coupe à la cisaille : 0. */
  kerf: number;
  /** Jeu de hauteur d'un montant. */
  studClearance: number;
  /** Plaque coupée plus courte que la hauteur. */
  plateGap: number;
  /** Appui du linteau de chaque côté de la baie. */
  lintelBearing: number;
  /** Montant de trame supprimé s'il est plus près que ça d'un montant renforcé (et joint de plaque à éviter). */
  studMinGap: number;
  /** Plus petite dimension d'une chute réutilisée. */
  minOffcut: number;
  plateMargin: number;
  insulationMargin: number;
  /** m² d'un rouleau (ou d'un paquet de panneaux). */
  insulationPack: { m2: number; unit: 'roll' | 'pack' };
  ratios: ConsumableRatios;
}

/* ------------------------------------------------------------ entrée du moteur */

/** Appui d'une extrémité. */
export type End = 'wall' | 'partition-t' | 'partition-corner' | 'free';

export interface SpecOpening {
  id: Id;
  kind: 'door' | 'opening';
  /** Depuis le départ de la cloison. */
  offset: number;
  width: number;
  height: number;
}

export interface SpecPartition {
  id: Id;
  /** « Cloison 1 · Chambre / Couloir ». */
  name: string;
  system: Id;
  /** Longueur du corps, de face d'appui à face d'appui. */
  length: number;
  height: number;
  spacing: 600 | 400;
  plates: Record<Face, PlateType>;
  insulation: Insulation | null;
  reinforcement: Reinforcement;
  start: End;
  end: End;
  /** Abscisses des cloisons qui s'arrêtent sur celle-ci (liaisons en T). */
  junctions: number[];
  openings: SpecOpening[];
  /** Faces carrelées (lu dans les zones du projet) : alerte si la plaque n'est pas hydrofuge. */
  tiledFaces: Face[];
}

export interface CloisonsSpec {
  partitions: SpecPartition[];
  systems: Record<Id, PartitionSystem>;
  settings: CloisonsSettings;
  /** Surface de murs démolis, m² (information). */
  demolishedArea: number;
}

/* --------------------------------------------------------------------- sortie */

export interface Alert {
  code: string;
  partition?: Id;
  params?: Record<string, string | number>;
}

export type StudRole = 'grid' | 'start' | 'end' | 'corner' | 'jamb' | 'junction' | 'cripple';

export interface Stud {
  /** Identifiant dans la cloison (pièce de `studs` du lot de barres). */
  id: string;
  /** Abscisse le long de l'axe. */
  x: number;
  length: number;
  role: StudRole;
}

export interface RailPiece {
  id: string;
  kind: 'top' | 'bottom' | 'lintel';
  /** Abscisses de début et de fin le long de l'axe. */
  x0: number;
  x1: number;
  length: number;
}

/** Origine d'une pièce de plaque : une feuille neuve ou une chute d'une pièce précédente. */
export type PlateSource = { sheet: number } | { offcut: string };

export interface PlatePiece {
  id: string;
  face: Face;
  layer: number;
  type: PlateType;
  x0: number;
  x1: number;
  width: number;
  height: number;
  /** Hauteur du bas de la pièce depuis le sol (au-dessus d'une baie : sa hauteur), mm. */
  y0: number;
  /** Surface réellement posée (baies déduites), mm². */
  area: number;
  /** Rempli après l'optimisation des feuilles. */
  from: PlateSource | null;
}

export interface PartitionResult {
  id: Id;
  /** false : erreur bloquante, la cloison est exclue des totaux. */
  ok: boolean;
  studs: Stud[];
  rails: RailPiece[];
  plates: PlatePiece[];
  /** Décalage retenu de chaque face et couche, mm (après correction pour les baies). */
  offsets: { face: Face; layer: number; offset: number }[];
  /** Surface de la cavité isolée, m². */
  insulationArea: number;
  alerts: Alert[];
}

/** Lot de plaques d'un type et d'une épaisseur : feuilles achetées et chutes. */
export interface PlateLot {
  type: PlateType;
  thickness: number;
  /** Feuilles utilisées, par format « 2500x1200 ». */
  sheets: Record<string, number>;
  /** Feuilles à acheter (marge comprise), par format. */
  purchased: Record<string, number>;
  /** Chutes gardées à la fin, `[largeur, hauteur, identifiant]`. */
  offcuts: [number, number, string][];
}

export interface ConsumableLine {
  key:
    'screw25' | 'screw35' | 'jointTape' | 'jointCompound' | 'resilientStrip' | 'fixing' | 'cornerBead' | 'woodInsert';
  /** Besoin, en pièces, mètres ou kg selon la ligne. */
  need: number;
  unit: 'piece' | 'm' | 'kg';
  pack: number;
  packs: number;
}

export interface Totals {
  /** Par produit : « <largeur d'ossature> ». */
  rails: Record<string, BarsResult>;
  /** Par produit et longueur de barre : « <largeur d'ossature>:<longueur> ». */
  studs: Record<string, BarsResult>;
  plates: PlateLot[];
  /** Par nature d'isolant. */
  insulation: Partial<Record<InsulationKind, { area: number; packs: number; unit: 'roll' | 'pack' }>>;
  consumables: ConsumableLine[];
  demolishedArea: number;
}

export interface CloisonsResult {
  partitions: PartitionResult[];
  totals: Totals;
  alerts: Alert[];
}
