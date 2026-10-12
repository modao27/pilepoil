/**
 * Couleurs PilePoil pour le code hors CSS (jsPDF, three.js, canvas).
 * Copie de src/ui/design/identite/tokens/brand.ts, complétée en fin de fichier pour l'application.
 */
export const brand = {
  petrole: '#174F50',
  terracotta: '#D17A59',
  ocre: '#C7A45A',
  sauge: '#D8E3DC',
  ivoire: '#FAF1E9',
  charbon: '#252D2D',
  terracottaTexte: '#A4502F',
  ocreTexte: '#7E6020',
  charbonDoux: '#5C6666',
} as const;

/** Même valeurs en RVB 0–255 pour jsPDF (setFillColor, setTextColor). */
export const brandRgb = {
  petrole: [23, 79, 80],
  terracotta: [209, 122, 89],
  ocre: [199, 164, 90],
  sauge: [216, 227, 220],
  ivoire: [250, 241, 233],
  charbon: [37, 45, 45],
  terracottaTexte: [164, 80, 47],
} as const satisfies Record<string, readonly [number, number, number]>;

export const appName = 'PilePoil';
export const tagline = 'Vos travaux, au millimètre près.';

/* Ajouts de l'application. */

/** Fond de l'application (--color-bg) en clair et en sombre : theme-color, scène 3D. */
export const background = { light: brand.ivoire, dark: '#182121' } as const;

/** Compléments RVB pour les PDF : texte secondaire, filets, en-têtes de tableau. */
export const pdfRgb = {
  charbonDoux: [92, 102, 102],
  border: [201, 211, 206],
} as const satisfies Record<string, readonly [number, number, number]>;
