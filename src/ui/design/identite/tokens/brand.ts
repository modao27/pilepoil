/** Couleurs PilePoil pour le code hors CSS (jsPDF, three.js, canvas). */
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
