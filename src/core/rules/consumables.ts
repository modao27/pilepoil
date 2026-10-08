/** Constantes des consommables [shoppingItems]. */

/** Épaisseur supposée quand elle n'est pas renseignée (mm). */
export const DEFAULT_THICKNESS = 9;
/** Mortier de joint : sacs de 5 kg. */
export const GROUT_BAG_KG = 5;
/** Densité utilisée pour le joint (kg/dm³). */
export const GROUT_DENSITY = 1.6;
/** Croisillons : environ 1,3 par carreau de moins de 450 mm, sachets de 200. */
export const SPACERS = { perTile: 1.3, perBag: 200, maxLong: 450 } as const;
/** Cales de nivellement : environ 3 par carreau de 450 mm et plus, sachets de 100. */
export const LEVELING_CLIPS = { perTile: 3, perBag: 100 } as const;
/** Primaire d'accrochage (L/m²). */
export const PRIMER_L_PER_M2 = 0.15;
/** Profilés d'angle : barres de 2,5 m. */
export const PROFILE_BAR_M = 2.5;
/** Silicone : mètres par cartouche. */
export const SILICONE_M_PER_CARTRIDGE = 10;

/**
 * Joint en kg pour m2 de carrelage : (L + l)/(L × l) × épaisseur × largeur de joint × 1,6, marge comprise.
 * Ordre des opérations identique à legacy.
 */
export function groutKg(m2: number, long: number, short: number, thickness: number, joint: number, margin: number) {
  return (
    ((m2 * (long + short)) / (long * short)) *
    (thickness || DEFAULT_THICKNESS) *
    joint *
    GROUT_DENSITY *
    (1 + margin / 100)
  );
}
