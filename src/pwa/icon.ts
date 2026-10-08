/**
 * Icône de l'application : trois rangs de carreaux en pose décalée sur fond cobalt ; la coupe du rang du milieu
 * (jaune) et sa chute réemployée (verte) reprennent les couleurs de statut des plans.
 * Source unique des fichiers de public/ (scripts/make-icons.ts).
 */
export const ICON_COLORS = { background: '#2747c9', tile: '#ffffff', cut: '#f0be45', reuse: '#7cc79a' };

export interface IconOptions {
  /** Côté en pixels. */
  size: number;
  /** Marge autour des carreaux, en fraction du côté (zone sûre des icônes « maskable » : ≥ 0,22). */
  inset: number;
  /** Rayon des coins du fond, en fraction du côté (0 : carré plein, le système découpe). */
  radius: number;
}

export function iconSvg({ size, inset, radius }: IconOptions): string {
  const j = 0.045; // joint, en fraction de la zone des carreaux
  const rh = (1 - 2 * j) / 3;
  const tw = (1 - j) / 2;
  const half = (tw - j) / 2;
  const tiles: [number, number, number, string][] = [];
  for (const r of [0, 2]) {
    tiles.push([0, r, tw, ICON_COLORS.tile], [tw + j, r, tw, ICON_COLORS.tile]);
  }
  tiles.push(
    [0, 1, half, ICON_COLORS.cut],
    [half + j, 1, tw, ICON_COLORS.tile],
    [1 - half, 1, half, ICON_COLORS.reuse],
  );
  const area = size * (1 - 2 * inset);
  const o = size * inset;
  const k = (v: number) => +(o + v * area).toFixed(2);
  const s = (v: number) => +(v * area).toFixed(2);
  const rects = tiles
    .map(
      ([x, r, w, fill]) =>
        `<rect x="${k(x)}" y="${k(r * (rh + j))}" width="${s(w)}" height="${s(rh)}" rx="${s(0.015)}" fill="${fill}"/>`,
    )
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${+(size * radius).toFixed(2)}" fill="${ICON_COLORS.background}"/>` +
    rects +
    `</svg>`
  );
}

/** Fichiers produits dans public/ : nom, options, format. */
export const ICON_FILES: { name: string; options: IconOptions; type: 'svg' | 'png' }[] = [
  { name: 'favicon.svg', options: { size: 64, inset: 0.14, radius: 0.2 }, type: 'svg' },
  { name: 'icons/icon-192.png', options: { size: 192, inset: 0.16, radius: 0.2 }, type: 'png' },
  { name: 'icons/icon-512.png', options: { size: 512, inset: 0.16, radius: 0.2 }, type: 'png' },
  { name: 'icons/maskable-512.png', options: { size: 512, inset: 0.24, radius: 0 }, type: 'png' },
  { name: 'icons/apple-touch-icon-180.png', options: { size: 180, inset: 0.18, radius: 0 }, type: 'png' },
];
