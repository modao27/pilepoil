/**
 * Peinture de la bibliothèque (docs/peinture/SPEC.md §2 et §4) : type, contrôles, modèles types.
 * Pur et sérialisable. Contenances en litres (kg pour un enduit), rendements en m² par litre (par kg).
 */
import type { PaintPack, PaintSheen, PaintRole, PaintUse, SpecPaint, Tint } from './types';

type Id = string;

export const PAINT_SCHEMA = 1;

export interface Paint extends SpecPaint {
  schemaVersion: typeof PAINT_SCHEMA;
  brand: string;
  /** Aspect de la finition ; null pour un apprêt ou un enduit. */
  sheen: PaintSheen | null;
  /** Teinte nommée et sa pastille ; null : produit sans couleur propre (apprêt, enduit). */
  color: { name: string; hex: string } | null;
  photoId: Id | null;
  createdAt: number;
  updatedAt: number;
}

export type PaintError = 'name/empty' | 'yield/invalid' | 'coats/invalid' | 'packs/empty' | 'packs/invalid';

/** Erreurs bloquantes du formulaire de peinture. */
export function validatePaint(p: Paint): PaintError[] {
  const out: PaintError[] = [];
  if (!p.name.trim()) out.push('name/empty');
  if (p.role !== 'filler' && !(p.yield > 0)) out.push('yield/invalid');
  if (p.role !== 'filler' && (!Number.isInteger(p.coats) || p.coats < 1)) out.push('coats/invalid');
  if (!p.packs.length) out.push('packs/empty');
  else if (p.packs.some((k) => !(k.size > 0) || (k.price != null && k.price < 0))) out.push('packs/invalid');
  return out;
}

const T0 = Date.UTC(2026, 9, 13);

interface TemplateFields {
  name: string;
  role: PaintRole;
  sheen: PaintSheen | null;
  color: Paint['color'];
  tint?: Tint;
  uses: PaintUse[];
  yield: number;
  coats: number;
  sizes: number[];
}

function template(id: string, t: TemplateFields): Paint {
  const { sizes, tint, ...rest } = t;
  return {
    schemaVersion: PAINT_SCHEMA,
    id: 'modele-' + id,
    brand: '',
    photoId: null,
    createdAt: T0,
    updatedAt: T0,
    packs: sizes.map((size): PaintPack => ({ size, price: null })),
    ...(tint ? { tint } : {}),
    ...rest,
  };
}

/** Modèles types génériques, sans marque, prix vides : rendements indicatifs, à vérifier sur le pot. */
export const PAINT_TEMPLATES: readonly Paint[] = [
  template('blanc-mat', {
    name: 'Blanc mat murs et plafonds',
    role: 'finish',
    sheen: 'mat',
    color: { name: 'Blanc', hex: '#f4f1ea' },
    tint: 'light',
    uses: ['walls'],
    yield: 10,
    coats: 2,
    sizes: [2.5, 5, 10],
  }),
  template('satin-humide', {
    name: 'Satiné pièces humides',
    role: 'finish',
    sheen: 'satin',
    color: { name: 'Blanc', hex: '#f4f1ea' },
    tint: 'light',
    uses: ['walls', 'humid'],
    yield: 12,
    coats: 2,
    sizes: [1, 2.5, 5],
  }),
  template('boiseries', {
    name: 'Boiseries satin',
    role: 'finish',
    sheen: 'satin',
    color: { name: 'Blanc', hex: '#f4f1ea' },
    tint: 'light',
    uses: ['woodwork'],
    yield: 12,
    coats: 2,
    sizes: [0.5, 1, 2.5],
  }),
  template('sous-couche', {
    name: 'Sous-couche universelle',
    role: 'primer',
    sheen: null,
    color: null,
    uses: ['walls', 'woodwork'],
    yield: 10,
    coats: 1,
    sizes: [2.5, 10],
  }),
  template('enduit', {
    name: 'Enduit de rebouchage en poudre',
    role: 'filler',
    sheen: null,
    color: null,
    uses: ['walls'],
    yield: 1,
    coats: 1,
    sizes: [1, 5],
  }),
];

/** Peinture neuve (formulaire). */
export function createPaint(id: Id, now: number, o: Partial<Paint> = {}): Paint {
  return { ...PAINT_TEMPLATES[0]!, id, name: 'Nouvelle peinture', createdAt: now, updatedAt: now, ...o };
}
