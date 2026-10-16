/** Pastille approchée d'après un nom de teinte (« Gris clair », « Chêne doré ») : premier mot connu, ou null. */

const COLORS: readonly [RegExp, string][] = [
  [/terr?acott?a|terre cuite|cotto/, '#b5653f'],
  [/anthracite/, '#3c3f42'],
  [/noir/, '#232323'],
  [/gris (fonce|moyen)/, '#7c7c79'],
  [/gris/, '#a8a7a3'],
  [/ivoire|creme|lin\b/, '#e6dccb'],
  [/greige|grege|taupe|sable/, '#b9ab97'],
  [/beige/, '#d6c4a5'],
  [/blanc/, '#f2f0eb'],
  [/sauge|olive|kaki/, '#9caf95'],
  [/vert/, '#4f7a5a'],
  [/bleu|denim|marine/, '#3e5a78'],
  [/rouge|bordeaux/, '#9b3b33'],
  [/rose/, '#d9a6a0'],
  [/jaune|moutarde|ocre/, '#c9a43a'],
  [/noyer|wenge|fonce/, '#6b4a32'],
  [/marron|brun/, '#8a5f3c'],
  [/chene|bois|naturel|miel|dore|blond/, '#c49a62'],
];

export function colorHex(name: string | undefined): string | null {
  if (!name) return null;
  const n = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return COLORS.find(([re]) => re.test(n))?.[1] ?? null;
}
