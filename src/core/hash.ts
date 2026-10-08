/** Hachage entier déterministe (décalés aléatoires, mélange de couleurs). */
export function hash(i: number): number {
  let h = Math.imul(i + 0x9e37, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : nombres dans [0, 1), même suite pour une même graine. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Texte JSON canonique : clés d'objet triées, propriétés `undefined` omises (comme JSON.stringify). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map((v) => stableStringify(v ?? null)).join(',') + ']';
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Empreinte stable d'une valeur JSON (cyrb53, 14 chiffres hexadécimaux) : indépendante de l'ordre des clés. */
export function fingerprint(value: unknown): string {
  const s = stableStringify(value);
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
