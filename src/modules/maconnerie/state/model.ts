/** Données de la maçonnerie dans un projet (`project.modules.maconnerie`) : prix saisis. Les murets arrivent ensuite. */
export const MACONNERIE_ID = 'maconnerie';
export const MACONNERIE_SCHEMA = 1;

export interface MaconnerieData {
  /** Prix saisis dans le projet, par clé de ligne d'achat. */
  prices: Record<string, number>;
}

export const createMaconnerieData = (): MaconnerieData => ({ prices: {} });
