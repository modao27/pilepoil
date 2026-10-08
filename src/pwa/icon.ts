/**
 * Icône de l'application Pilepoil : un niveau à bulle sur fond cobalt, la bulle pile entre ses deux repères.
 * Couleurs du système de design (cobalt, blanc, vert « réemploi », jaune « coupe »).
 * Source unique des fichiers de public/ (scripts/make-icons.ts).
 */
export const ICON_COLORS = { background: '#2747c9', body: '#ffffff', vial: '#7cc79a', bubble: '#f0be45' };

export interface IconOptions {
  /** Côté en pixels. */
  size: number;
  /** Marge autour du niveau, en fraction du côté (zone sûre des icônes « maskable » : ≥ 0,22). */
  inset: number;
  /** Rayon des coins du fond, en fraction du côté (0 : carré plein, le système découpe). */
  radius: number;
}

/** Formes du dessin, dans la zone utile [0, 1] × [0, 1] (avant marge). */
export const LEVEL = {
  body: { x: 0, y: 0.27, w: 1, h: 0.46, r: 0.1 },
  vial: { x: 0.17, y: 0.38, w: 0.66, h: 0.24, r: 0.12 },
  /** Repères verticaux de la fiole (abscisses), épaisseur. */
  marks: { xs: [0.38, 0.62], w: 0.03 },
  bubble: { cx: 0.5, cy: 0.5, rx: 0.085, ry: 0.08 },
} as const;

export function iconSvg({ size, inset, radius }: IconOptions): string {
  const area = size * (1 - 2 * inset);
  const o = size * inset;
  const k = (v: number) => +(o + v * area).toFixed(2);
  const s = (v: number) => +(v * area).toFixed(2);
  const rect = (b: { x: number; y: number; w: number; h: number; r: number }, fill: string) =>
    `<rect x="${k(b.x)}" y="${k(b.y)}" width="${s(b.w)}" height="${s(b.h)}" rx="${s(b.r)}" fill="${fill}"/>`;
  const { vial, marks, bubble } = LEVEL;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${+(size * radius).toFixed(2)}" fill="${ICON_COLORS.background}"/>` +
    rect(LEVEL.body, ICON_COLORS.body) +
    rect(vial, ICON_COLORS.vial) +
    `<ellipse cx="${k(bubble.cx)}" cy="${k(bubble.cy)}" rx="${s(bubble.rx)}" ry="${s(bubble.ry)}" fill="${ICON_COLORS.bubble}"/>` +
    marks.xs
      .map((x) => rect({ x: x - marks.w / 2, y: vial.y, w: marks.w, h: vial.h, r: 0 }, ICON_COLORS.background))
      .join('') +
    `</svg>`
  );
}

/** Fichiers produits dans public/ : nom, options, format. */
export const ICON_FILES: { name: string; options: IconOptions; type: 'svg' | 'png' }[] = [
  { name: 'favicon.svg', options: { size: 64, inset: 0.1, radius: 0.2 }, type: 'svg' },
  { name: 'icons/icon-192.png', options: { size: 192, inset: 0.14, radius: 0.2 }, type: 'png' },
  { name: 'icons/icon-512.png', options: { size: 512, inset: 0.14, radius: 0.2 }, type: 'png' },
  { name: 'icons/maskable-512.png', options: { size: 512, inset: 0.24, radius: 0 }, type: 'png' },
  { name: 'icons/apple-touch-icon-180.png', options: { size: 180, inset: 0.16, radius: 0 }, type: 'png' },
];
