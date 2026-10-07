/** Hachage entier déterministe (décalés aléatoires, mélange de couleurs). */
export function hash(i: number): number {
  let h = Math.imul(i + 0x9e37, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}
