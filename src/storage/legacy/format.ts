/** Format de sauvegarde legacy (localStorage), après normalisation par `normSurface`. */

export type LegacySide = 'L' | 'R' | 'T' | 'B';

export interface LegacyZone {
  size: number;
  unit: 'rows' | 'cm' | 'rest';
  pattern: string;
  a: number;
  b: number;
  angle: number;
  start: 'corner' | 'tile' | 'joint';
  dx: number;
  dy: number;
  c1: string;
  c2: string;
  mix: 'uni' | 'alt' | 'rand';
  grout: string;
  box: number;
  th: number;
  photo: string | null;
  photoRot: boolean;
}

export interface LegacyOpening {
  type: 'window' | 'door' | 'socket' | 'trap' | 'tub' | 'other';
  w: number;
  h: number;
  x: number;
  sill: number;
  cov: boolean;
  /** cm */
  depth: number;
  proj: number;
  rv: Record<LegacySide, boolean>;
}

export interface LegacyFold {
  x: number;
  type: 'in' | 'out';
  ang: number;
  cov: boolean;
}

export interface LegacySurface {
  W: number;
  H: number;
  j: number;
  split: 'h' | 'v';
  margin: number;
  shade: number;
  reuse: boolean;
  orient: 'free' | '180' | 'none';
  kerf: number;
  minr: number;
  optGoal: string;
  kind: 'wall' | 'floor';
  zones: LegacyZone[];
  res: LegacyOpening[];
  folds: LegacyFold[];
  plinth: { len: number; h: number; zone: number };
  hid: Record<LegacySide, boolean>;
  jcov: boolean;
  name?: string;
}

export interface LegacyRoom {
  L: number;
  l: number;
  H: number;
  T: number;
  surf: Partial<Record<'A' | 'B' | 'C' | 'D' | 'F', number>>;
}

export interface LegacyProject {
  surfaces: LegacySurface[];
  active: number;
  room: LegacyRoom | null;
  prices?: Record<string, number>;
  photos?: Record<string, string>;
}

export interface LegacyScenario {
  name?: string;
  state?: unknown;
  metrics?: Record<string, unknown> | null;
  thumb?: string;
  date?: string;
}

/** Contenu brut des clés localStorage de legacy. */
export interface LegacyStorage {
  'calepinage-v3': string | null;
  'calepinage-v2': string | null;
  'calepinage-scenarios': string | null;
  'calepinage-nuancier': string | null;
}

export const LEGACY_KEYS = ['calepinage-v3', 'calepinage-v2', 'calepinage-scenarios', 'calepinage-nuancier'] as const;

/** Fichier produit par le bouton « Exporter mes données » de legacy. */
export const LEGACY_EXPORT_FORMAT = 'calepinage-legacy-export';
