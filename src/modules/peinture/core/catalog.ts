/**
 * Peintures posées une fois comme modèles types, en plus des cinq modèles d'origine (paint.ts) :
 * - `lm-<réf>` : relevées sur leroymerlin.fr le 16/10/2026 (caractéristiques seulement : ni photo ni prix). Les
 *   fiches ne donnent presque jamais le rendement : 10 m²/L, la valeur du calculateur Leroy Merlin, sauf mention ;
 * - `type-…` : génériques sans marque, rendements indicatifs.
 * Rendements à vérifier sur le pot. Contenances en litres (kg pour un enduit).
 */
import { PAINT_SCHEMA, type Paint } from './paint';
import type { PaintRole, PaintSheen, PaintUse, Tint } from './types';

const T0 = Date.UTC(2026, 9, 16);

const WHITE = { name: 'Blanc', hex: '#f4f1ea' };

interface Fields {
  name: string;
  brand?: string;
  role: PaintRole;
  sheen?: PaintSheen;
  color?: Paint['color'];
  tint?: Tint;
  uses: PaintUse[];
  yield: number;
  coats?: number;
  sizes: number[];
}

function paint(id: string, f: Fields): Paint {
  const finish = f.role === 'finish';
  const color = finish ? (f.color ?? WHITE) : null;
  const tint = finish ? (f.tint ?? 'light') : undefined;
  return {
    schemaVersion: PAINT_SCHEMA,
    id,
    name: f.name,
    brand: f.brand ?? '',
    role: f.role,
    sheen: finish ? (f.sheen ?? 'mat') : null,
    color,
    ...(tint ? { tint } : {}),
    uses: f.uses,
    yield: f.yield,
    coats: f.coats ?? (finish ? 2 : 1),
    packs: f.sizes.map((size) => ({ size, price: null })),
    photoId: null,
    createdAt: T0,
    updatedAt: T0,
  };
}

export const PAINT_CATALOG: readonly Paint[] = [
  // Leroy Merlin
  paint('lm-95908997', {
    name: 'Luxens Résistant velours blanc',
    brand: 'Luxens',
    role: 'finish',
    sheen: 'velvet',
    uses: ['walls', 'woodwork', 'humid'],
    yield: 10,
    sizes: [5, 10],
  }),
  paint('lm-95909015', {
    name: 'Luxens Résistant mat blanc',
    brand: 'Luxens',
    role: 'finish',
    sheen: 'mat',
    uses: ['walls', 'woodwork', 'humid'],
    yield: 10,
    sizes: [10],
  }),
  paint('lm-95908993', {
    name: 'Luxens Résistant satin blanc',
    brand: 'Luxens',
    role: 'finish',
    sheen: 'satin',
    uses: ['walls', 'woodwork', 'humid'],
    yield: 10,
    sizes: [5, 10],
  }),
  paint('lm-82033318', {
    name: 'Tollens Tolpro Hydro velours blanc',
    brand: 'Tollens',
    role: 'finish',
    sheen: 'velvet',
    uses: ['walls', 'humid'],
    yield: 11,
    sizes: [10],
  }),
  // Finitions murs et plafonds
  paint('type-velours-blanc', {
    name: 'Blanc velours murs et plafonds',
    role: 'finish',
    sheen: 'velvet',
    uses: ['walls'],
    yield: 10,
    sizes: [2.5, 5, 10],
  }),
  paint('type-satin-blanc', {
    name: 'Blanc satiné murs',
    role: 'finish',
    sheen: 'satin',
    uses: ['walls'],
    yield: 11,
    sizes: [2.5, 5, 10],
  }),
  paint('type-mat-lessivable', {
    name: 'Blanc mat lessivable',
    role: 'finish',
    sheen: 'mat',
    uses: ['walls'],
    yield: 10,
    sizes: [2.5, 10],
  }),
  paint('type-plafond-mat', {
    name: 'Plafond blanc mat',
    role: 'finish',
    sheen: 'mat',
    uses: ['walls'],
    yield: 10,
    sizes: [2.5, 10],
  }),
  paint('type-plafond-humide', {
    name: 'Plafond pièces humides mat',
    role: 'finish',
    sheen: 'mat',
    uses: ['walls', 'humid'],
    yield: 10,
    sizes: [2.5],
  }),
  paint('type-velours-humide', {
    name: 'Velours pièces humides',
    role: 'finish',
    sheen: 'velvet',
    uses: ['walls', 'humid'],
    yield: 12,
    sizes: [2.5, 5],
  }),
  paint('type-cuisine-bain', {
    name: 'Cuisine et bain satiné',
    role: 'finish',
    sheen: 'satin',
    uses: ['walls', 'humid'],
    yield: 12,
    sizes: [2],
  }),
  paint('type-couleur-claire', {
    name: 'Couleur claire satinée (lin)',
    role: 'finish',
    sheen: 'satin',
    color: { name: 'Lin', hex: '#e6dccb' },
    tint: 'light',
    uses: ['walls'],
    yield: 11,
    sizes: [0.5, 2.5],
  }),
  paint('type-couleur-moyenne', {
    name: 'Couleur moyenne velours (grège)',
    role: 'finish',
    sheen: 'velvet',
    color: { name: 'Grège', hex: '#b9ab97' },
    tint: 'medium',
    uses: ['walls'],
    yield: 11,
    sizes: [0.5, 2.5],
  }),
  paint('type-couleur-foncee', {
    name: 'Couleur foncée mat (bleu nuit)',
    role: 'finish',
    sheen: 'mat',
    color: { name: 'Bleu nuit', hex: '#2d3a4f' },
    tint: 'dark',
    uses: ['walls'],
    yield: 10,
    sizes: [0.5, 2.5],
  }),
  // Boiseries et radiateurs
  paint('type-laque-satin', {
    name: 'Laque satinée boiseries',
    role: 'finish',
    sheen: 'satin',
    uses: ['woodwork'],
    yield: 14,
    sizes: [0.5, 1, 2.5],
  }),
  paint('type-laque-brillante', {
    name: 'Laque brillante boiseries',
    role: 'finish',
    sheen: 'gloss',
    uses: ['woodwork'],
    yield: 14,
    sizes: [0.5, 1, 2.5],
  }),
  paint('type-radiateur', {
    name: 'Radiateurs satiné',
    role: 'finish',
    sheen: 'satin',
    uses: ['woodwork'],
    yield: 12,
    sizes: [0.5],
  }),
  // Sous-couches
  paint('type-sous-couche-platre', {
    name: 'Sous-couche plaque de plâtre',
    role: 'primer',
    uses: ['walls'],
    yield: 10,
    sizes: [2.5, 10],
  }),
  paint('type-impression-fixateur', {
    name: 'Fixateur d’impression murs',
    role: 'primer',
    uses: ['walls'],
    yield: 12,
    sizes: [2.5, 10],
  }),
  paint('type-sous-couche-humidite', {
    name: 'Sous-couche anti-humidité',
    role: 'primer',
    uses: ['walls', 'humid'],
    yield: 8,
    sizes: [2.5],
  }),
  paint('type-sous-couche-bois', {
    name: 'Sous-couche bois',
    role: 'primer',
    uses: ['woodwork'],
    yield: 12,
    sizes: [0.5, 2.5],
  }),
  paint('type-sous-couche-tannin', {
    name: 'Sous-couche bois tanniques',
    role: 'primer',
    uses: ['woodwork'],
    yield: 10,
    sizes: [0.5],
  }),
  // Enduits
  paint('type-enduit-lissage', {
    name: 'Enduit de lissage en pâte',
    role: 'filler',
    uses: ['walls'],
    yield: 1,
    sizes: [5, 15],
  }),
  paint('type-enduit-rebouchage-pate', {
    name: 'Enduit de rebouchage en pâte',
    role: 'filler',
    uses: ['walls'],
    yield: 1,
    sizes: [0.5, 1],
  }),
];
