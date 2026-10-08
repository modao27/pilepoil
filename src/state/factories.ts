/** Objets neufs avec les valeurs par défaut de legacy. */
import { OPENING_DEFAULTS } from '../modules/carrelage';
import type { Corner, Id, Opening, OpeningType, Project, Surface, Tile, TileShape, Zone } from './model';
import { PROJECT_SCHEMA, TILE_SCHEMA } from './model';

export function newId(): Id {
  return crypto.randomUUID();
}

export const DEFAULT_GROUT = '#8f8a83';
export const DEFAULT_COLOR_B = '#3f5a6b';
export const DEFAULT_PALETTE = {
  tiles: ['#d8cfc2', '#f1ede6', '#3f5a6b', '#2f2f31'],
  grouts: ['#f2f0eb', '#c9c4bb', '#8f8a83', '#3d3d3f'],
};

const fmtCm = (mm: number) => (mm / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Nom par défaut d'un carreau : « 60 × 30 cm », « Hexagone 20 cm »… */
export function tileName(shape: TileShape, length: number, width: number): string {
  if (shape === 'hex') return `Hexagone ${fmtCm(length)} cm`;
  if (shape === 'octo') return `Octogone ${fmtCm(length)} cm`;
  const dims = `${fmtCm(length)} × ${fmtCm(width)} cm`;
  return shape === 'chevron' ? `Lame Hongrie ${dims}` : dims;
}

export function createTile(o: Partial<Tile> = {}, now = Date.now()): Tile {
  return {
    schemaVersion: TILE_SCHEMA,
    id: newId(),
    name: '60 × 30 cm',
    shape: 'rect',
    length: 600,
    width: 300,
    thickness: 9,
    color: '#d8cfc2',
    photoId: null,
    m2PerBox: 1.44,
    pricePerM2: null,
    orientation: 'free',
    createdAt: now,
    updatedAt: now,
    ...o,
  };
}

export function createZone(tileId: Id, o: Partial<Zone> = {}): Zone {
  return {
    id: newId(),
    size: 3,
    unit: 'rest',
    tileId,
    tileUpright: false,
    pattern: 'half',
    angle: 0,
    start: 'corner',
    offsetX: 0,
    offsetY: 0,
    mix: 'solid',
    colorB: DEFAULT_COLOR_B,
    groutColor: DEFAULT_GROUT,
    photoRandomFlip: true,
    ...o,
  };
}

export function createOpening(type: OpeningType = 'window', o: Partial<Opening> = {}): Opening {
  return {
    id: newId(),
    type,
    x: 1000,
    covered: true,
    revealDepth: 0,
    reveals: { left: true, right: true, top: true, bottom: false },
    projection: 700,
    ...OPENING_DEFAULTS[type],
    ...o,
  };
}

export function createCorner(o: Partial<Corner> = {}): Corner {
  return { id: newId(), x: 1500, type: 'in', angle: 90, covered: true, ...o };
}

export function createSurface(tileId: Id, o: Partial<Surface> = {}): Surface {
  return {
    id: newId(),
    name: 'Surface 1',
    kind: 'wall',
    width: 3000,
    height: 2400,
    joint: 3,
    split: 'h',
    zones: [createZone(tileId)],
    openings: [],
    corners: [],
    plinth: null,
    hiddenEdges: { top: true, bottom: true, left: true, right: true },
    junctionsCovered: false,
    ...o,
  };
}

export function createProject(surfaces: Surface[], o: Partial<Project> = {}, now = Date.now()): Project {
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: newId(),
    name: 'Nouveau projet',
    createdAt: now,
    updatedAt: now,
    surfaces,
    room: null,
    settings: { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20, shadeVariation: 0.06, optimizerGoal: 'thin' },
    prices: {},
    ...o,
  };
}
