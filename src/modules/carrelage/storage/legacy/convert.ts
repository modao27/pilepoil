/**
 * Conversion pure des données legacy vers le modèle (voir docs/MODEL.md, Import legacy).
 * Aucun accès au stockage ici : les photos restent en dataURL, l'écriture est faite par import.ts.
 * Produit des documents v1 (projet carrelage seul) ; import.ts les migre en v2 avant de les écrire.
 */
import type { Metrics, OptimizerGoal, PatternId } from '../../core';
import { newId, tileName } from '../../state/factories';
import type { Id, Palette } from '../../../../state/model';
import { TILE_SCHEMA, type CarrelageProjectV1, type Opening, type RoomV1, type RoomWallKey, type ScenarioV1, type SurfaceV1, type Tile, type TileShape, type Zone } from '../../state/model';
import type {
  LegacyFold,
  LegacyOpening,
  LegacyProject,
  LegacyScenario,
  LegacyStorage,
  LegacySurface,
  LegacyZone,
} from './format';

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/* ---------- normalisation, identique à legacy (defZone, defRes, defFold, DEFST, normSurface) ---------- */

export function defZone(o: Loose): LegacyZone {
  return {
    size: 3,
    unit: 'rest',
    pattern: 'half',
    a: 600,
    b: 300,
    angle: 0,
    start: 'corner',
    dx: 0,
    dy: 0,
    c1: '#d8cfc2',
    c2: '#3f5a6b',
    mix: 'uni',
    grout: '#8f8a83',
    box: 1.44,
    th: 9,
    photo: null,
    photoRot: true,
    ...o,
  } as LegacyZone;
}

const defRes = (o: Loose): LegacyOpening =>
  ({
    type: 'window',
    w: 1000,
    h: 1200,
    x: 1000,
    sill: 900,
    cov: true,
    depth: 0,
    proj: 700,
    rv: { L: true, R: true, T: true, B: false },
    ...o,
  }) as LegacyOpening;

const defFold = (o: Loose): LegacyFold => ({ x: 1500, type: 'in', ang: 90, cov: true, ...o }) as LegacyFold;

const DEFST = () => ({
  W: 3000,
  H: 2400,
  j: 3,
  split: 'h',
  margin: 10,
  shade: 0.06,
  reuse: true,
  orient: 'free',
  kerf: 2,
  minr: 20,
  hid: { T: true, B: true, L: true, R: true },
  jcov: false,
  res: [],
  plinth: { len: 0, h: 80, zone: 0 },
  optGoal: 'thin',
  kind: 'wall',
  folds: [],
});

export function normSurface(raw: unknown): LegacySurface {
  const o = obj(raw);
  const s = { ...DEFST(), ...o } as Loose;
  const zones = arr(o.zones).length ? arr(o.zones) : [{}];
  s.zones = zones.map((z) => defZone({ grout: o.grout || '#8f8a83', ...obj(z) }));
  delete s.grout;
  if (!o.orient) s.orient = o.rot === false ? '180' : 'free';
  delete s.rot;
  s.res = arr(o.res).map((r) => defRes(obj(r)));
  s.folds = arr(o.folds).map((f) => defFold(obj(f)));
  s.plinth = { len: 0, h: 80, zone: 0, ...obj(o.plinth) };
  s.hid = { T: true, B: true, L: true, R: true, ...obj(o.hid) };
  return s as unknown as LegacySurface;
}

/** Projet legacy normalisé (calepinage-v3, sinon calepinage-v2), ou null s'il n'y a rien à importer [load]. */
export function readLegacyProject(store: LegacyStorage): LegacyProject | null {
  const p3 = obj(parse(store['calepinage-v3']));
  const surfaces = arr(p3.surfaces);
  if (surfaces.length) {
    return {
      surfaces: surfaces.map(normSurface),
      active: Math.min(Math.max(0, Number(p3.active) | 0), surfaces.length - 1),
      room: (p3.room as LegacyProject['room']) || null,
      prices: obj(p3.prices) as Record<string, number>,
      photos: obj(p3.photos) as Record<string, string>,
    };
  }
  const v2 = obj(parse(store['calepinage-v2']));
  if (arr(v2.zones).length) return { surfaces: [normSurface(v2)], active: 0, room: null, prices: {}, photos: {} };
  return null;
}

function parse(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* ---------- conversion vers le modèle ---------- */

const SHAPES: Partial<Record<string, TileShape>> = { hex: 'hex', octo: 'octo', chevron: 'chevron' };
const MIX = { uni: 'solid', alt: 'alternate', rand: 'random' } as const;
const GOALS: readonly OptimizerGoal[] = ['thin', 'tiles', 'bal', 'sym'];
/** Clé de produit legacy (prix « tile|… ») du carreau rectangulaire principal d'une zone. */
function rectTileKey(z: LegacyZone): string {
  return `rect|${Math.round(Math.max(z.a, z.b))}x${Math.round(Math.min(z.a, z.b))}||${z.c1.toLowerCase()}`;
}

/** Bibliothèque construite pendant l'import : un carreau par combinaison distincte. */
class TileCollector {
  readonly tiles: Tile[] = [];
  private readonly byKey = new Map<string, Tile>();
  constructor(
    private readonly now: number,
    private readonly photoId: (legacyId: string | null) => Id | null,
  ) {}

  /** Carreau d'une zone legacy ; renvoie son id et le sens de pose. */
  get(z: LegacyZone, orientation: Tile['orientation']): { tileId: Id; upright: boolean } {
    const shape: TileShape = SHAPES[z.pattern] ?? 'rect';
    const regular = shape === 'hex' || shape === 'octo';
    const length = regular ? z.a : Math.max(z.a, z.b),
      width = regular ? z.a : Math.min(z.a, z.b);
    const photoId = this.photoId(z.photo);
    const key = [shape, length, width, z.th, z.c1.toLowerCase(), z.box, photoId, orientation].join('|');
    let t = this.byKey.get(key);
    if (!t) {
      t = {
        schemaVersion: TILE_SCHEMA,
        id: newId(),
        name: tileName(shape, length, width),
        shape,
        length,
        width,
        thickness: z.th,
        color: z.c1,
        photoId,
        m2PerBox: z.box,
        pricePerM2: null,
        orientation,
        createdAt: this.now,
        updatedAt: this.now,
      };
      this.byKey.set(key, t);
      this.tiles.push(t);
    }
    return { tileId: t.id, upright: !regular && z.a < z.b };
  }
}

function openingFrom(r: LegacyOpening): Opening {
  return {
    id: newId(),
    type: r.type,
    x: r.x,
    sill: r.sill,
    width: r.w,
    height: r.h,
    covered: !!r.cov,
    revealDepth: r.depth * 10,
    reveals: { left: !!r.rv.L, right: !!r.rv.R, top: !!r.rv.T, bottom: !!r.rv.B },
    projection: r.proj,
  };
}

function surfaceFrom(S: LegacySurface, i: number, tiles: TileCollector, orientation: Tile['orientation']): SurfaceV1 {
  const zones: Zone[] = S.zones.map((z) => {
    const { tileId, upright } = tiles.get(z, orientation);
    return {
      id: newId(),
      size: z.unit === 'cm' ? z.size * 10 : z.size,
      unit: z.unit === 'cm' ? 'length' : z.unit,
      tileId,
      tileUpright: upright,
      pattern: z.pattern as PatternId,
      angle: z.angle,
      start: z.start,
      offsetX: z.dx,
      offsetY: z.dy,
      mix: MIX[z.mix] ?? 'random',
      colorB: z.c2,
      groutColor: z.grout,
      photoRandomFlip: z.photoRot !== false,
    };
  });
  const pz = Math.min(Math.max(0, S.plinth.zone | 0), zones.length - 1);
  return {
    id: newId(),
    name: S.name || 'Surface ' + (i + 1),
    kind: S.kind,
    width: S.W,
    height: S.H,
    joint: S.j,
    split: S.split,
    zones,
    openings: S.res.map(openingFrom),
    corners: S.folds.map((f) => ({ id: newId(), x: f.x, type: f.type, angle: f.ang, covered: !!f.cov })),
    plinth: S.plinth.len > 0 ? { length: S.plinth.len, height: S.plinth.h, zoneId: zones[pz]!.id } : null,
    hiddenEdges: { top: !!S.hid.T, bottom: !!S.hid.B, left: !!S.hid.L, right: !!S.hid.R },
    junctionsCovered: !!S.jcov,
  };
}

export interface ConvertedProject {
  project: CarrelageProjectV1;
  tiles: Tile[];
}

/** Projet legacy normalisé → projet du modèle et carreaux de bibliothèque. */
export function convertProject(
  L: LegacyProject,
  opts: { now: number; name?: string; photoId: (legacyId: string | null) => Id | null },
): ConvertedProject {
  const act = L.surfaces[L.active] ?? L.surfaces[0]!;
  const tiles = new TileCollector(opts.now, opts.photoId);
  const surfaces = L.surfaces.map((S, i) => surfaceFrom(S, i, tiles, act.orient));
  let room: RoomV1 | null = null;
  if (L.room) {
    const walls: Partial<Record<RoomWallKey, Id>> = {};
    for (const [k, i] of Object.entries(L.room.surf ?? {})) {
      const s = i != null ? surfaces[i] : undefined;
      if (s) walls[k === 'F' ? 'floor' : (k as RoomWallKey)] = s.id;
    }
    room = { length: L.room.L, width: L.room.l, height: L.room.H, tiledHeight: L.room.T, walls };
  }
  const prices = { ...(L.prices ?? {}) };
  // Prix au m² des carreaux : reportés sur le carreau quand la clé legacy correspond à son produit principal.
  L.surfaces.forEach((S, si) =>
    S.zones.forEach((z, zi) => {
      if (SHAPES[z.pattern]) return;
      const price = prices['tile|' + rectTileKey(z)];
      const t = tiles.tiles.find((x) => x.id === surfaces[si]!.zones[zi]!.tileId);
      if (t && price > 0 && t.pricePerM2 == null) t.pricePerM2 = price;
    }),
  );
  const project: CarrelageProjectV1 = {
    schemaVersion: 1,
    id: newId(),
    name: opts.name ?? 'Projet importé',
    createdAt: opts.now,
    updatedAt: opts.now,
    surfaces,
    room,
    settings: {
      margin: act.margin,
      reuseOffcuts: !!act.reuse,
      kerf: act.kerf,
      minOffcut: act.minr,
      shadeVariation: act.shade,
      optimizerGoal: GOALS.includes(act.optGoal as OptimizerGoal) ? (act.optGoal as OptimizerGoal) : 'thin',
    },
    prices,
  };
  return { project, tiles: tiles.tiles };
}

/* ---------- import complet ---------- */

export interface LegacyImport {
  project: CarrelageProjectV1 | null;
  tiles: Tile[];
  /** Photos à écrire : id du modèle → dataURL legacy. */
  photos: { id: Id; dataUrl: string }[];
  scenarios: ScenarioV1[];
  palette: Palette | null;
}

const METRIC_KEYS = ['posed', 'needed', 'order', 'm2', 'boxes', 'cuts', 'thin', 'vis', 'reused', 'minCut'] as const;

function metricsFrom(m: unknown): Metrics | null {
  const o = obj(m);
  if (!METRIC_KEYS.every((k) => typeof o[k] === 'number')) return null;
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, o[k]])) as unknown as Metrics;
}

/** « 07/10/2026 14:32 » (fr-FR court) → ms ; repli sur `fallback`. */
export function parseFrDate(s: unknown, fallback: number): number {
  const m = typeof s === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})/.exec(s) : null;
  return m ? new Date(+m[3]!, +m[2]! - 1, +m[1]!, +m[4]!, +m[5]!).getTime() : fallback;
}

/** Convertit tout le contenu legacy. Rien n'est écrit. */
export function convertLegacy(store: LegacyStorage, now: number): LegacyImport {
  const L = readLegacyProject(store);
  const photos: LegacyImport['photos'] = [];
  const photoIds = new Map<string, Id>();
  const legacyPhotos = L?.photos ?? {};
  const photoId = (legacyId: string | null): Id | null => {
    if (!legacyId) return null;
    const data = legacyPhotos[legacyId];
    if (typeof data !== 'string' || !data.startsWith('data:image/')) return null;
    let id = photoIds.get(legacyId);
    if (!id) {
      id = newId();
      photoIds.set(legacyId, id);
      photos.push({ id, dataUrl: data });
    }
    return id;
  };

  const main = L ? convertProject(L, { now, photoId }) : null;
  const scenarios: ScenarioV1[] = [];
  if (main) {
    const sc = obj(parse(store['calepinage-scenarios']));
    for (const slot of ['A', 'B'] as const) {
      const c = obj(sc[slot]) as LegacyScenario;
      const state = obj(c.state);
      const snap = arr(state.surfaces).length
        ? readLegacyProject({ ...EMPTY_STORAGE, 'calepinage-v3': JSON.stringify({ ...state, photos: legacyPhotos }) })
        : arr(state.zones).length
          ? { surfaces: [normSurface(state)], active: 0, room: null, prices: {}, photos: legacyPhotos }
          : null;
      if (!snap) continue;
      const converted = convertProject(snap, { now, name: c.name || 'Scénario ' + slot, photoId });
      let thumbnailId: Id | null = null;
      if (typeof c.thumb === 'string' && c.thumb.startsWith('data:image/')) {
        thumbnailId = newId();
        photos.push({ id: thumbnailId, dataUrl: c.thumb });
      }
      scenarios.push({
        schemaVersion: 1,
        id: newId(),
        projectId: main.project.id,
        slot,
        name: c.name || 'Scénario ' + slot,
        snapshot: converted,
        metrics: metricsFrom(c.metrics),
        thumbnailId,
        createdAt: parseFrDate(c.date, now),
      });
    }
  }

  const pal = obj(parse(store['calepinage-nuancier']));
  const palette =
    Array.isArray(pal.tiles) && Array.isArray(pal.grouts)
      ? {
          tiles: pal.tiles.filter((x): x is string => typeof x === 'string'),
          grouts: pal.grouts.filter((x): x is string => typeof x === 'string'),
        }
      : null;

  return { project: main?.project ?? null, tiles: main?.tiles ?? [], photos, scenarios, palette };
}

export const EMPTY_STORAGE: LegacyStorage = {
  'calepinage-v3': null,
  'calepinage-v2': null,
  'calepinage-scenarios': null,
  'calepinage-nuancier': null,
};
