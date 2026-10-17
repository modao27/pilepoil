export interface MaconnerieSpec {
  walls: never[];
}
export interface MaconnerieResult {
  alerts: string[];
}

/** Calcul des murs de maçonnerie : à venir (étape 2). */
export function computeMaconnerie(_spec: MaconnerieSpec): MaconnerieResult {
  return { alerts: [] };
}
