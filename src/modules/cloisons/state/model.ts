/**
 * Données des cloisons dans un projet (`project.modules.cloisons`, docs/cloisons/SPEC.md §2). Les cloisons elles-mêmes
 * (axe, épaisseur, portes) sont dans le plan (`project.site.partitions`, docs/BOITE.md §3 bis) ; le module garde leurs
 * réglages de calcul, les réglages communs et les prix saisis.
 */
import { DEFAULT_REINFORCEMENT, defaultSettings } from '../core/defaults';
import type { CloisonsSettings, Face, Id, Insulation, PlateType, Reinforcement } from '../core/types';

export const CLOISONS_ID = 'cloisons';
/** 1 : réglages par cloison, réglages communs, prix. */
export const CLOISONS_SCHEMA = 1;

export interface PartitionSettings {
  /** Système de la bibliothèque `systems` ; null : le premier de même épaisseur. */
  system: Id | null;
  /** null : la plus basse des hauteurs sous plafond des pièces voisines. */
  height: number | null;
  spacing: 600 | 400;
  plates: Record<Face, PlateType>;
  insulation: Insulation | null;
  reinforcement: Reinforcement;
}

export interface CloisonsData {
  /** Réglages par cloison du plan, par identifiant de cloison ; absent : valeurs par défaut. */
  partitions: Record<Id, PartitionSettings>;
  settings: CloisonsSettings;
  /** Prix saisis dans le projet, par clé de ligne d'achat (`cloisons:rail:48`…). */
  prices: Record<string, number>;
}

export const defaultPartitionSettings = (): PartitionSettings => ({
  system: null,
  height: null,
  spacing: 600,
  plates: { a: 'standard', b: 'standard' },
  insulation: null,
  reinforcement: { ...DEFAULT_REINFORCEMENT },
});

export const createCloisonsData = (): CloisonsData => ({
  partitions: {},
  settings: defaultSettings(),
  prices: {},
});
