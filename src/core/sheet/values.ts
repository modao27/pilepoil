/**
 * Valeurs d'une fiche produit au format français : « 1,44 m² », « 60 x 120 cm », « 2,5 L », « 34,81 € / carton »,
 * « 10 à 12 ». Pur ; null quand rien n'est lisible. Longueurs rendues en millimètres.
 */

const NUMBER = /\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;

function toNumber(s: string): number {
  return Number(s.replace(/\s/g, '').replace(',', '.'));
}

/** Nombres du texte, dans l'ordre. */
export function numbers(s: string): number[] {
  return [...s.matchAll(NUMBER)].map((m) => toNumber(m[0])).filter((n) => Number.isFinite(n));
}

/** Premier nombre, ou null. */
export function firstNumber(s: string | undefined): number | null {
  if (s === undefined) return null;
  const n = numbers(s)[0];
  return n === undefined ? null : n;
}

/** Plus petit nombre (« 10 à 12 m²/L » : 10, la valeur prudente pour un rendement). */
export function lowestNumber(s: string | undefined): number | null {
  if (s === undefined) return null;
  const all = numbers(s);
  return all.length ? Math.min(...all) : null;
}

export type LengthUnit = 'mm' | 'cm' | 'm';

const UNIT_MM: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000 };

/** Unité de longueur écrite dans le texte (« 60 cm », « (en mm) »), ou null. */
export function lengthUnit(s: string): LengthUnit | null {
  const m = /(?:\d|\(en |\b)(mm|cm|m)\b(?![²2])/i.exec(s);
  return m ? (m[1]!.toLowerCase() as LengthUnit) : null;
}

/**
 * Longueur en mm : unité lue dans la valeur, sinon dans le libellé (« Longueur (en cm) »), sinon `fallback`.
 * Arrondie au dixième de millimètre.
 */
export function lengthMm(value: string | undefined, label: string, fallback: LengthUnit): number | null {
  const n = firstNumber(value);
  if (n === null || !(n > 0)) return null;
  const unit = lengthUnit(value!) ?? lengthUnit(label) ?? fallback;
  return Math.round(n * UNIT_MM[unit] * 10) / 10;
}

/** Deux dimensions « 60 x 120 cm », « 60×60 », « l.31,6 x L.60 cm » : [a, b] en mm (cm par défaut), ou null. */
export function dimensionsMm(s: string | undefined): [number, number] | null {
  if (s === undefined) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(mm|cm)?\s*[x×*]\s*[a-z.]*\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?/i.exec(s);
  if (!m) return null;
  const k = UNIT_MM[(m[4] ?? m[2] ?? 'cm').toLowerCase() as LengthUnit];
  const a = toNumber(m[1]!) * k,
    b = toNumber(m[3]!) * k;
  return a > 0 && b > 0 ? [a, b] : null;
}

/**
 * Contenance en litres (kg pour un enduit) : « 2,5 L », « 750 ml », « 15 kg ». Sans unité écrite, le premier nombre,
 * sauf si `unitRequired` (contenance cherchée dans un nom de produit).
 */
export function volume(s: string | undefined, unitRequired = false): number | null {
  if (s === undefined) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litres?|kg|g)\b/i.exec(s);
  if (!m) return unitRequired ? null : firstNumber(s);
  const n = toNumber(m[1]!);
  const u = m[2]!.toLowerCase();
  return u === 'ml' || u === 'g' ? n / 1000 : u === 'cl' ? n / 100 : n;
}

export type PriceUnit = 'm2' | 'pack' | 'unit';

/** Prix en euros et ce qu'il paie : « 22,90 € / m² », « 34,81 € par carton ». */
export function price(s: string | undefined): { amount: number; per: PriceUnit } | null {
  const amount = firstNumber(s);
  if (amount === null) return null;
  const t = s!.toLowerCase();
  const per: PriceUnit = /m²|m2/.test(t)
    ? 'm2'
    : /bo[iî]te|carton|colis|paquet|pack|lot|pot|seau/.test(t)
      ? 'pack'
      : 'unit';
  return { amount, per };
}
