/**
 * Teintes de peinture (docs/peinture/SPEC.md §2, B2) : palette nommée, sans marque, choisie dans chaque pose ;
 * teinte claire, moyenne ou foncée déduite de la luminance. Pur.
 */
import type { PaintColor, Tint } from './types';

export type ColorFamily =
  'whites' | 'beiges' | 'greys' | 'greens' | 'blues' | 'reds' | 'yellows' | 'browns' | 'purples' | 'blacks';

export interface PaletteColor extends PaintColor {
  family: ColorFamily;
}

const c = (family: ColorFamily, name: string, hex: string): PaletteColor => ({ family, name, hex });

/** Palette, par famille, du plus clair au plus foncé dans chaque famille. */
export const PAINT_COLORS: readonly PaletteColor[] = [
  c('whites', 'Blanc pur', '#f7f7f4'),
  c('whites', 'Blanc coton', '#f4f1ea'),
  c('whites', 'Blanc cassé', '#f2efe6'),
  c('whites', 'Blanc craie', '#ebe8e0'),
  c('whites', 'Blanc ivoire', '#efe8d8'),
  c('whites', 'Blanc lin', '#ece5d8'),
  c('beiges', 'Écru', '#ede4cf'),
  c('beiges', 'Lin', '#e6dccb'),
  c('beiges', 'Beige rosé', '#e2cfc2'),
  c('beiges', 'Cachemire', '#d1c3b1'),
  c('beiges', 'Sable', '#dccbb0'),
  c('beiges', 'Ficelle', '#cdb999'),
  c('beiges', 'Pierre', '#c2b8a8'),
  c('beiges', 'Mastic', '#c9bba5'),
  c('beiges', 'Grège', '#b9ab97'),
  c('beiges', 'Argile', '#b49c86'),
  c('beiges', 'Galet', '#a99d8d'),
  c('beiges', 'Taupe', '#8b7d70'),
  c('greys', 'Gris perle', '#dcdcd8'),
  c('greys', 'Gris nuage', '#c8c9c6'),
  c('greys', 'Gris tourterelle', '#b5aea6'),
  c('greys', 'Gris béton', '#a3a39e'),
  c('greys', 'Gris souris', '#8e8c88'),
  c('greys', 'Gris ardoise', '#6e7377'),
  c('greys', 'Gris anthracite', '#3c3f42'),
  c('greens', 'Vert menthe', '#b6dcc9'),
  c('greens', 'Vert amande', '#c9d6b5'),
  c('greens', 'Vert céladon', '#b4c8b0'),
  c('greens', 'Vert sauge', '#9caf95'),
  c('greens', 'Vert eucalyptus', '#8fa99c'),
  c('greens', 'Vert lichen', '#a3a37c'),
  c('greens', 'Vert olive', '#7b7b4f'),
  c('greens', 'Vert kaki', '#6d6a4b'),
  c('greens', 'Vert émeraude', '#1f6b55'),
  c('greens', 'Vert forêt', '#2f4b3a'),
  c('greens', 'Vert bouteille', '#24412f'),
  c('blues', 'Bleu glacier', '#d6e4ea'),
  c('blues', 'Bleu ciel', '#bcd4e6'),
  c('blues', 'Bleu lavande', '#b3b7d6'),
  c('blues', 'Bleu gris', '#8a9cad'),
  c('blues', 'Bleu azur', '#5b8fc7'),
  c('blues', 'Bleu jean', '#4f6d8f'),
  c('blues', 'Bleu orage', '#4f6272'),
  c('blues', 'Bleu canard', '#1f5b66'),
  c('blues', 'Bleu pétrole', '#24495a'),
  c('blues', 'Bleu marine', '#26324d'),
  c('blues', 'Bleu nuit', '#2d3a4f'),
  c('reds', 'Pêche', '#f1c3a6'),
  c('reds', 'Rose poudré', '#e3c4bd'),
  c('reds', 'Rose blush', '#e8b9ad'),
  c('reds', 'Corail', '#e07a62'),
  c('reds', 'Vieux rose', '#c4908a'),
  c('reds', 'Terracotta', '#b5653f'),
  c('reds', 'Brique', '#9a4a35'),
  c('reds', 'Rouge carmin', '#9b2c2c'),
  c('reds', 'Bordeaux', '#6e2532'),
  c('yellows', 'Jaune paille', '#eedc9a'),
  c('yellows', 'Jaune citron', '#f2e05c'),
  c('yellows', 'Safran', '#e0a030'),
  c('yellows', 'Miel', '#d0a35e'),
  c('yellows', 'Moutarde', '#c9a43a'),
  c('yellows', 'Ocre', '#c48a3a'),
  c('browns', 'Caramel', '#b07a45'),
  c('browns', 'Cannelle', '#a0623a'),
  c('browns', 'Noisette', '#9c7a5b'),
  c('browns', 'Café', '#6f4e37'),
  c('browns', 'Chocolat', '#5a3d2e'),
  c('purples', 'Lilas', '#c8b6d6'),
  c('purples', 'Mauve', '#a58aa6'),
  c('purples', 'Prune', '#6b3f5c'),
  c('purples', 'Aubergine', '#4a2c40'),
  c('blacks', 'Brun noir', '#3b2e26'),
  c('blacks', 'Noir bleuté', '#1f2630'),
  c('blacks', 'Noir', '#232323'),
];

/** Luminance relative (sRGB) d'une couleur `#rrggbb`, de 0 (noir) à 1 (blanc). */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return 1;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Teinte claire, moyenne ou foncée d'une couleur (alerte « une couche de plus » en teinte foncée). */
export function tintOf(hex: string): Tint {
  const y = luminance(hex);
  return y >= 0.5 ? 'light' : y < 0.12 ? 'dark' : 'medium';
}

/** Blanc cassé des modèles types : couleur d'une pose quand ni la pose ni la peinture n'ont de teinte. */
export const FALLBACK_COLOR = '#f4f1ea';

/** Couleur affichée d'une finition : teinte de la pose, sinon celle de la peinture. */
export function shownColor(pose: PaintColor | null | undefined, paint: PaintColor | null | undefined): string {
  return pose?.hex ?? paint?.hex ?? FALLBACK_COLOR;
}
