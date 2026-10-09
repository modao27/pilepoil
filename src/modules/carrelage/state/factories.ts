/** Objets neufs avec les valeurs par défaut de legacy. */
import { OPENING_DEFAULTS } from '../core';
import type { Id } from '../../../state/model';
import type {
  FloorTiling,
  Opening,
  OpeningType,
  Reservation,
  ReservationType,
  RoomTiling,
  Tile,
  TileShape,
  TilingBase,
  WallTiling,
  Zone,
} from './model';
import { DEFAULT_SETTINGS, type CarrelageData } from './data';
import { TILE_SCHEMA } from './model';

export function newId(): Id {
  return crypto.randomUUID();
}

export const DEFAULT_GROUT = '#8f8a83';
export const DEFAULT_COLOR_B = '#3f5a6b';

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

/** Réservation propre au carrelage (prise, trappe, baignoire, autre). */
export function createReservation(type: ReservationType = 'socket', o: Partial<Reservation> = {}): Reservation {
  return { ...createOpening(type), type, ...o };
}

/** Réglages communs d'une surface neuve : une zone, joint de 3 mm. */
function tilingBase(tileId: Id, o: Partial<TilingBase>): TilingBase {
  return { joint: 3, split: 'h', zones: [createZone(tileId)], reservations: [], junctionsCovered: false, ...o };
}

export function createFloorTiling(tileId: Id, o: Partial<FloorTiling> = {}): FloorTiling {
  return { ...tilingBase(tileId, o), plinth: null, edgesHidden: true, ...o };
}

export function createWallTiling(tileId: Id, o: Partial<WallTiling> = {}): WallTiling {
  return {
    ...tilingBase(tileId, o),
    tiledHeight: null,
    hiddenEdges: { top: true, bottom: true, left: true, right: true },
    openings: {},
    ...o,
  };
}

export function createRoomTiling(o: Partial<RoomTiling> = {}): RoomTiling {
  return { floor: null, walls: {}, outerCornersCovered: true, ...o };
}

/** Données carrelage neuves. */
export function createData(o: Partial<CarrelageData> = {}): CarrelageData {
  return { rooms: {}, settings: { ...DEFAULT_SETTINGS }, prices: {}, ...o };
}
