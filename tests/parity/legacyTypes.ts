/** Format de sauvegarde de legacy (localStorage) après normalisation par `normSurface` : entrée de la parité. */

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

/** Projet partiel accepté par `applyState` (les valeurs manquantes prennent les défauts legacy). */
export interface LegacyInput {
  surfaces: (Partial<Omit<LegacySurface, 'zones' | 'res' | 'folds'>> & {
    zones?: Partial<LegacyZone>[];
    res?: Partial<LegacyOpening>[];
    folds?: Partial<LegacyFold>[];
    name?: string;
  })[];
  active: 0;
  room?: LegacyRoom | null;
}

export interface ParityConfig {
  name: string;
  project: LegacyInput;
  /** Lance aussi l'optimiseur sur ces zones de la surface 0 avec cet objectif. */
  optimize?: { goal: 'thin' | 'tiles' | 'bal' | 'sym'; zones: number[] };
}
