export * from './colors';
export * from './parse';
export * from './values';

/** Résultat de la lecture d'une fiche pour un formulaire : champs remplis et liste de ceux qui l'ont été. */
export interface SheetRead<T> {
  fields: Partial<T>;
  read: (keyof T & string)[];
}

/** Ajoute un champ lu (ignoré si la valeur est null ou undefined). */
export function put<T, K extends keyof T & string>(r: SheetRead<T>, key: K, value: T[K] | null | undefined): void {
  if (value === null || value === undefined) return;
  r.fields[key] = value;
  if (!r.read.includes(key)) r.read.push(key);
}
