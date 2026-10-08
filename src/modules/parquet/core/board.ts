/**
 * Lame de parquet de la bibliothèque (docs/parquet/SPEC.md §2) : type, contrôles, modèles types. Unités : mm.
 * Pur et sérialisable (moteur du parquet en P1).
 */

type Id = string;

export const BOARD_SCHEMA = 1;

export type BoardKind = 'solid' | 'engineered' | 'laminate' | 'vinyl';

export interface Board {
  schemaVersion: typeof BOARD_SCHEMA;
  id: Id;
  name: string;
  kind: BoardKind;
  /** Longueurs disponibles ; une seule = longueur fixe. */
  lengths: number[];
  /** Proportion de chaque longueur dans un paquet (somme = 1), longueurs mixtes. */
  lengthMix: number[] | null;
  /** Largeur utile, hors languette. */
  width: number;
  thickness: number;
  profile: 'click' | 'tongue-groove';
  /** Lames gauche/droite (bâton rompu, point de Hongrie). */
  handed: boolean;
  color: string;
  photoId: Id | null;
  /** Par variante si handed ; c'est lui qui sert au calcul des paquets. */
  boardsPerPack: number;
  /** Affichage et contrôle de cohérence seulement. */
  m2PerPack: number;
  pricePerPack: number | null;
  createdAt: number;
  updatedAt: number;
}

export type BoardError =
  | 'name/empty'
  | 'lengths/empty'
  | 'lengths/invalid'
  | 'mix/count'
  | 'mix/sum'
  | 'width/invalid'
  | 'thickness/invalid'
  | 'pack/boards';

type PackFields = Pick<Board, 'lengths' | 'lengthMix' | 'width' | 'boardsPerPack'>;

/** Longueur moyenne d'une lame, pondérée par les proportions des longueurs mixtes. */
export function meanLength(b: Pick<Board, 'lengths' | 'lengthMix'>): number {
  if (!b.lengths.length) return 0;
  const mix = b.lengthMix;
  if (!mix || mix.length !== b.lengths.length) return b.lengths.reduce((t, l) => t + l, 0) / b.lengths.length;
  return b.lengths.reduce((t, l, i) => t + l * mix[i]!, 0);
}

/** Surface d'un paquet calculée à partir des lames, m². */
export function packArea(b: PackFields): number {
  return (b.boardsPerPack * meanLength(b) * b.width) / 1e6;
}

/** `pack-mismatch` : m²/paquet annoncé à plus de 3 % de la surface des lames du paquet (alerte, non bloquant). */
export function packMismatch(b: PackFields & Pick<Board, 'm2PerPack'>): boolean {
  const a = packArea(b);
  return a > 0 && b.m2PerPack > 0 && Math.abs(b.m2PerPack - a) / a > 0.03;
}

/** Erreurs bloquantes du formulaire de lame. */
export function validateBoard(b: Board): BoardError[] {
  const out: BoardError[] = [];
  if (!b.name.trim()) out.push('name/empty');
  if (!b.lengths.length) out.push('lengths/empty');
  else if (b.lengths.some((l) => !(l > 0))) out.push('lengths/invalid');
  if (b.lengthMix) {
    if (b.lengthMix.length !== b.lengths.length) out.push('mix/count');
    else if (b.lengthMix.some((m) => m < 0) || Math.abs(b.lengthMix.reduce((t, m) => t + m, 0) - 1) > 0.005)
      out.push('mix/sum');
  }
  if (!(b.width > 0)) out.push('width/invalid');
  if (!(b.thickness > 0)) out.push('thickness/invalid');
  if (!(b.boardsPerPack >= 1) || !Number.isInteger(b.boardsPerPack)) out.push('pack/boards');
  return out;
}

const T0 = Date.UTC(2026, 9, 8);

type TemplateFields = Omit<Board, 'schemaVersion' | 'id' | 'photoId' | 'pricePerPack' | 'createdAt' | 'updatedAt'>;

function template(id: string, b: TemplateFields): Board {
  return {
    schemaVersion: BOARD_SCHEMA,
    id: 'modele-' + id,
    photoId: null,
    pricePerPack: null,
    createdAt: T0,
    updatedAt: T0,
    ...b,
  };
}

/** Modèles types génériques, sans marque, prix vides (SPEC §2) : à dupliquer et ajuster. */
export const BOARD_TEMPLATES: readonly Board[] = [
  template('stratifie', {
    name: 'Stratifié 1285 × 192',
    kind: 'laminate',
    lengths: [1285],
    lengthMix: null,
    width: 192,
    thickness: 8,
    profile: 'click',
    handed: false,
    color: '#c9a77c',
    boardsPerPack: 9,
    m2PerPack: 2.22,
  }),
  template('vinyle', {
    name: 'Vinyle clipsable 1220 × 180',
    kind: 'vinyl',
    lengths: [1220],
    lengthMix: null,
    width: 180,
    thickness: 5,
    profile: 'click',
    handed: false,
    color: '#b8a48c',
    boardsPerPack: 10,
    m2PerPack: 2.2,
  }),
  template('contrecolle', {
    name: 'Contrecollé 1900 × 190',
    kind: 'engineered',
    lengths: [1900],
    lengthMix: null,
    width: 190,
    thickness: 14,
    profile: 'click',
    handed: false,
    color: '#b98a5a',
    boardsPerPack: 6,
    m2PerPack: 2.17,
  }),
  template('massif', {
    name: 'Massif longueurs mixtes 400 à 1200 × 140',
    kind: 'solid',
    lengths: [400, 600, 800, 1000, 1200],
    lengthMix: [0.1, 0.2, 0.3, 0.25, 0.15],
    width: 140,
    thickness: 20,
    profile: 'tongue-groove',
    handed: false,
    color: '#a87445',
    boardsPerPack: 9,
    m2PerPack: 1.05,
  }),
  template('baton-rompu', {
    name: 'Bâton rompu 600 × 100 (lames A/B)',
    kind: 'engineered',
    lengths: [600],
    lengthMix: null,
    width: 100,
    thickness: 10,
    profile: 'tongue-groove',
    handed: true,
    color: '#b07d4f',
    boardsPerPack: 12,
    m2PerPack: 0.72,
  }),
  template('hongrie-45', {
    name: 'Point de Hongrie 45° 600 × 90 (lames A/B)',
    kind: 'engineered',
    lengths: [600],
    lengthMix: null,
    width: 90,
    thickness: 10,
    profile: 'tongue-groove',
    handed: true,
    color: '#9c6a3f',
    boardsPerPack: 12,
    m2PerPack: 0.65,
  }),
  template('hongrie-60', {
    name: 'Point de Hongrie 60° 500 × 90 (lames A/B)',
    kind: 'engineered',
    lengths: [500],
    lengthMix: null,
    width: 90,
    thickness: 10,
    profile: 'tongue-groove',
    handed: true,
    color: '#8f6038',
    boardsPerPack: 14,
    m2PerPack: 0.63,
  }),
];

/** Lame neuve (formulaire). */
export function createBoard(id: Id, now: number, o: Partial<Board> = {}): Board {
  return { ...BOARD_TEMPLATES[0]!, id, name: 'Nouvelle lame', createdAt: now, updatedAt: now, ...o };
}
