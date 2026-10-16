/**
 * Carreaux de référence relevés sur leroymerlin.fr le 16/10/2026 (caractéristiques techniques seulement : ni photo
 * ni prix). Posés une fois comme modèles types ; l'identifiant `lm-<réf>` renvoie à la fiche produit. Pastille de
 * couleur approchée d'après le nom de teinte. Dimensions en mm, longueur = plus grand côté.
 */
import { TILE_SCHEMA, type Tile } from './model';

const T0 = Date.UTC(2026, 9, 16);

function lm(
  ref: string,
  name: string,
  length: number,
  width: number,
  thickness: number,
  m2PerBox: number,
  color: string,
): Tile {
  return {
    schemaVersion: TILE_SCHEMA,
    id: 'lm-' + ref,
    name,
    shape: 'rect',
    length,
    width,
    thickness,
    color,
    photoId: null,
    m2PerBox,
    pricePerM2: null,
    orientation: 'free',
    createdAt: T0,
    updatedAt: T0,
  };
}

export const TILE_CATALOG: readonly Tile[] = [
  // Sol et mur, grands formats
  lm('90543471', 'Artens Casablanca effet marbre blanc 60 × 60', 600, 600, 9.5, 1.08, '#ece9e4'),
  lm('90543472', 'Artens Casablanca effet marbre blanc 60 × 120', 1200, 600, 9, 1.44, '#ece9e4'),
  lm('90543473', 'Artens Casablanca effet marbre blanc 30 × 60', 600, 300, 9.5, 1.08, '#ece9e4'),
  lm('95598390', 'Artens Urban effet béton beige 60 × 60', 600, 600, 9, 1.08, '#cfc2ad'),
  lm('95598435', 'Artens Melrose effet bois naturel 60 × 120', 1200, 600, 9, 1.44, '#b38d66'),
  lm('95985488', 'STN Ceramica Arcano effet béton gris 60 × 60', 600, 600, 9.5, 1.08, '#9a9893'),
  lm('90823561', 'Tiber effet travertin beige 60,4 × 60,4', 604, 604, 7.4, 1.46, '#d6c4a5'),
  lm('92393574', 'Tiber effet travertin beige 60 × 119,8', 1198, 600, 7.4, 1.44, '#d6c4a5'),
  lm('82003908', 'Quartzite effet pierre gris moyen 30 × 60,4', 604, 300, 7.4, 1.54, '#8d8d8a'),
  lm('89123943', 'Monastère effet pierre beige 80,5 × 80,5', 805, 805, 9, 1.3, '#cdbb9c'),
  lm('95598413', 'Artens Easy patchwork terracotta 45 × 45', 450, 450, 9.1, 1.42, '#b8704b'),
  lm('82935837', 'Gaya Forès Galbe Cottage géométrique 33,15 × 33,15', 331.5, 331.5, 7.3, 1.32, '#c9b79c'),
  // Imitation parquet
  lm('91656777', 'Artens Malte effet bois marron 19,8 × 119,8', 1198, 198, 8.5, 1.2, '#8a5f3c'),
  lm('97139881', 'STN Ceramica Timor effet chêne 23 × 120', 1200, 230, 9.7, 1.11, '#b48a5e'),
  lm('82862839', 'Artens Arden effet bois beige 20 × 80', 800, 200, 8.2, 1.28, '#c7a985'),
  // Mur
  lm('84731824', 'Artens Moha effet zellige bleu 31,6 × 60', 600, 316, 9.5, 1.52, '#2b6f7a'),
  lm('91656725', 'Artens Arctic vert sauge mat 30 × 90', 900, 300, 7, 1.35, '#9caf95'),
  lm('91656783', 'Artens Arctic sauge 59,6 × 119,4', 1194, 596, 7, 1.42, '#9caf95'),
  lm('92023549', 'Team satiné terracotta 30 × 60', 600, 300, 8, 1.62, '#b5653f'),
  lm('95240402', 'Instahouse Stay uni terracotta 20 × 60', 600, 200, 8.3, 1.44, '#b5653f'),
  lm('95598399', 'Artens Bricklane effet zellige denim 7,4 × 30,1', 301, 74, 8.2, 0.98, '#3e5a78'),
  lm('95598383', 'Artens Bricklane effet zellige vert foncé 10 × 10', 100, 100, 8.2, 0.54, '#2f5141'),
  lm('84865552', 'Pablo effet zellige noir 6 × 24', 240, 60, 10, 0.52, '#232323'),
  lm('95187216', 'Aelle Fango Cotto bejmat terracotta 5 × 15', 150, 50, 8, 0.495, '#b0603c'),
];
