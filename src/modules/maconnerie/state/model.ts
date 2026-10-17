/**
 * Données de la maçonnerie dans un projet (`project.modules.maconnerie`) : murs et panneaux saisis par leurs
 * dimensions, réglages, prix saisis. Le tracé des murets dans le plan vient avec la phase suivante.
 */
export const MACONNERIE_ID = 'maconnerie';
export const MACONNERIE_SCHEMA = 1;

export interface MasonryWall {
  id: string;
  name: string;
  /** mm */
  length: number;
  height: number;
  /** Matériau de la bibliothèque `materials` ; null : à choisir. */
  material: string | null;
  /** Joint (mm) ; null : celui de la technique du matériau. */
  joint: number | null;
}

export interface MaconnerieSettings {
  /** Marge de casse et de coupe (0,05 = 5 %). */
  margin: number;
  /** Sac de liant (kg). */
  binderBag: number;
}

export interface MaconnerieData {
  walls: MasonryWall[];
  settings: MaconnerieSettings;
  /** Prix saisis dans le projet, par clé de ligne d'achat. */
  prices: Record<string, number>;
}

export const defaultSettings = (): MaconnerieSettings => ({ margin: 0.05, binderBag: 25 });

export const createMaconnerieData = (): MaconnerieData => ({ walls: [], settings: defaultSettings(), prices: {} });
