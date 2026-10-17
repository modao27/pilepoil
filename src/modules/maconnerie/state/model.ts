/**
 * Données de la maçonnerie dans un projet (`project.modules.maconnerie`) : réglages des cloisons maçonnées du plan,
 * murs saisis par leurs dimensions, réglages communs, prix saisis. Les cloisons elles-mêmes (axe, épaisseur, hauteur,
 * portes) sont dans le plan (`project.site.partitions`, `construction: 'masonry'`).
 */
export const MACONNERIE_ID = 'maconnerie';
/** 1 : murs saisis ; 2 : zones, cloisons maçonnées du plan. */
export const MACONNERIE_SCHEMA = 2;

/** Zone d'un autre matériau dans un mur (mm) : x depuis le début du mur, y depuis le sol. */
export interface WallZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Matériau de la bibliothèque ; null : à choisir. */
  material: string | null;
  /** Joint (mm) ; null : celui de la technique du matériau. */
  joint: number | null;
}

/** Ce que la maçonnerie sait d'un mur : matériau de base, joint, zones. */
export interface WallBuild {
  /** Matériau de base ; null : à choisir. */
  material: string | null;
  joint: number | null;
  zones: WallZone[];
}

/** Mur saisi par ses dimensions (hors plan). */
export interface MasonryWall extends WallBuild {
  id: string;
  name: string;
  /** mm */
  length: number;
  height: number;
}

export interface MaconnerieSettings {
  /** Marge de casse et de coupe (0,05 = 5 %). */
  margin: number;
  /** Sac de liant (kg). */
  binderBag: number;
}

export interface MaconnerieData {
  /** Réglages des cloisons maçonnées du plan, par identifiant de cloison ; absent : valeurs par défaut. */
  partitions: Record<string, WallBuild>;
  walls: MasonryWall[];
  settings: MaconnerieSettings;
  /** Prix saisis dans le projet, par clé de ligne d'achat. */
  prices: Record<string, number>;
}

export const defaultSettings = (): MaconnerieSettings => ({ margin: 0.05, binderBag: 25 });

export const defaultBuild = (): WallBuild => ({ material: null, joint: null, zones: [] });

export const createMaconnerieData = (): MaconnerieData => ({
  partitions: {},
  walls: [],
  settings: defaultSettings(),
  prices: {},
});

export const MACONNERIE_MIGRATIONS: Record<number, (doc: unknown) => unknown> = {
  2: (doc) => {
    const d = doc as { walls: Record<string, unknown>[] } & Record<string, unknown>;
    return { ...d, partitions: {}, walls: d.walls.map((w) => ({ ...w, zones: [] })) };
  },
};
