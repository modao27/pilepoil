import { describe, expect, it } from 'vitest';
import {
  convertLegacy,
  EMPTY_STORAGE,
  normSurface,
  parseFrDate,
  readLegacyProject,
} from '../../src/modules/carrelage/storage/legacy/convert';
import { LEGACY_EXPORT_FORMAT } from '../../src/modules/carrelage/storage/legacy/format';
import {
  dataUrlToBlob,
  LegacyFileError,
  parseLegacyExport,
  readLocalStorage,
} from '../../src/modules/carrelage/storage/legacy/import';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const v3 = (o: unknown) => ({ ...EMPTY_STORAGE, 'calepinage-v3': JSON.stringify(o) });

describe('normalisation legacy', () => {
  it('valeurs par défaut, ancien réglage de rotation, joint hérité de la surface', () => {
    const s = normSurface({ rot: false, grout: '#111111', zones: [{ a: 200 }, { grout: '#222222' }] });
    expect(s.orient).toBe('180');
    expect(s.zones.map((z) => [z.a, z.b, z.grout])).toEqual([
      [200, 300, '#111111'],
      [600, 300, '#222222'],
    ]);
    expect(s).toMatchObject({ W: 3000, H: 2400, j: 3, kind: 'wall', plinth: { len: 0, h: 80, zone: 0 } });
    expect('grout' in s).toBe(false);
  });

  it('calepinage-v3 prioritaire, sinon calepinage-v2, sinon rien', () => {
    expect(
      readLegacyProject({ ...EMPTY_STORAGE, 'calepinage-v2': JSON.stringify({ zones: [{}], W: 1000 }) })!.surfaces[0]!
        .W,
    ).toBe(1000);
    expect(readLegacyProject(EMPTY_STORAGE)).toBeNull();
    expect(readLegacyProject({ ...EMPTY_STORAGE, 'calepinage-v3': '{pas du json' })).toBeNull();
    expect(readLegacyProject(v3({ surfaces: [{}, {}], active: 9 }))!.active).toBe(1);
  });
});

describe('conversion vers le modèle', () => {
  it('bibliothèque : un carreau par produit distinct, carreau debout, hexagone', () => {
    const r = convertLegacy(
      v3({
        surfaces: [
          {
            zones: [
              { a: 300, b: 600 },
              { a: 600, b: 300 },
              { pattern: 'hex', a: 200, b: 999 },
            ],
          },
          { zones: [{ a: 600, b: 300, c1: '#ffffff' }] },
        ],
        active: 0,
      }),
      0,
    );
    expect(r.tiles.map((t) => [t.name, t.shape, t.length, t.width])).toEqual([
      ['60 × 30 cm', 'rect', 600, 300],
      ['Hexagone 20 cm', 'hex', 200, 200],
      ['60 × 30 cm', 'rect', 600, 300],
    ]);
    const [z0, z1, z2] = r.project!.surfaces[0]!.zones;
    expect(z0!.tileId).toBe(z1!.tileId);
    expect([z0!.tileUpright, z1!.tileUpright, z2!.tileUpright]).toEqual([true, false, false]);
  });

  it('unités, ouvertures, angles, plinthe, pièce, réglages', () => {
    const r = convertLegacy(
      v3({
        surfaces: [
          {
            name: 'Mur A',
            margin: 15,
            shade: 0.1,
            optGoal: 'bal',
            orient: 'none',
            zones: [{ unit: 'cm', size: 12.5 }, {}],
            res: [{ type: 'door', depth: 15, rv: { L: true, R: false, T: true, B: false } }],
            folds: [{ x: 900, type: 'out', cov: false }],
            plinth: { len: 3000, h: 100, zone: 5 },
            hid: { T: false },
          },
          { kind: 'floor' },
        ],
        active: 0,
        room: { L: 3000, l: 2000, H: 2500, T: 2200, surf: { A: 0, F: 1, B: 7 } },
      }),
      0,
    );
    const p = r.project!,
      s = p.surfaces[0]!;
    expect(s.name).toBe('Mur A');
    expect(p.surfaces[1]!.name).toBe('Surface 2');
    expect(s.zones[0]).toMatchObject({ unit: 'length', size: 125 });
    expect(s.openings[0]).toMatchObject({
      type: 'door',
      revealDepth: 150,
      reveals: { left: true, right: false, top: true, bottom: false },
    });
    expect(s.corners[0]).toMatchObject({ x: 900, type: 'out', angle: 90, covered: false });
    expect(s.plinth).toEqual({ length: 3000, height: 100, zoneId: s.zones[1]!.id });
    expect(s.hiddenEdges).toEqual({ top: false, bottom: true, left: true, right: true });
    expect(p.room).toEqual({
      length: 3000,
      width: 2000,
      height: 2500,
      tiledHeight: 2200,
      walls: { A: s.id, floor: p.surfaces[1]!.id },
    });
    expect(p.settings).toEqual({
      margin: 15,
      reuseOffcuts: true,
      kerf: 2,
      minOffcut: 20,
      shadeVariation: 0.1,
      optimizerGoal: 'bal',
    });
    expect(r.tiles.every((t) => t.orientation === 'none')).toBe(true);
  });

  it('prix : carreau au m² reporté sur le carreau, tous les prix gardés', () => {
    const r = convertLegacy(
      v3({
        surfaces: [{ zones: [{ a: 300, b: 600, c1: '#ABCDEF' }] }],
        active: 0,
        prices: { 'tile|rect|600x300||#abcdef': 32.5, colle: 18 },
      }),
      0,
    );
    expect(r.tiles[0]!.pricePerM2).toBe(32.5);
    expect(r.project!.prices).toEqual({ 'tile|rect|600x300||#abcdef': 32.5, colle: 18 });
  });

  it('photos : une par photo utilisée, partagée par les carreaux', () => {
    const r = convertLegacy(
      v3({
        surfaces: [{ zones: [{ photo: 'ph1' }, { photo: 'ph1', c1: '#000000' }, { photo: 'absente' }] }],
        active: 0,
        photos: { ph1: PNG, inutile: PNG },
      }),
      0,
    );
    expect(r.photos).toHaveLength(1);
    expect(r.tiles.map((t) => t.photoId)).toEqual([r.photos[0]!.id, r.photos[0]!.id, null]);
  });

  it('scénarios A/B, vignette, nuancier', () => {
    const r = convertLegacy(
      {
        ...v3({ surfaces: [{}], active: 0 }),
        'calepinage-scenarios': JSON.stringify({
          A: {
            name: 'Gris',
            state: { surfaces: [{ W: 1000 }], active: 0 },
            thumb: PNG,
            date: '07/10/2026 14:32',
            metrics: {
              posed: 1,
              needed: 2,
              order: 3,
              m2: 1,
              boxes: 1,
              cuts: 0,
              thin: 0,
              vis: 0,
              reused: 0,
              minCut: 0,
              cost: 9,
            },
          },
          B: { state: { zones: [{}], W: 800 } },
        }),
        'calepinage-nuancier': JSON.stringify({ tiles: ['#fff', 3], grouts: [] }),
      },
      0,
    );
    expect(r.scenarios.map((s) => [s.slot, s.name, s.snapshot.project.surfaces[0]!.width])).toEqual([
      ['A', 'Gris', 1000],
      ['B', 'Scénario B', 800],
    ]);
    expect(r.scenarios.every((s) => s.projectId === r.project!.id)).toBe(true);
    expect(r.scenarios[0]!.metrics).toEqual({
      posed: 1,
      needed: 2,
      order: 3,
      m2: 1,
      boxes: 1,
      cuts: 0,
      thin: 0,
      vis: 0,
      reused: 0,
      minCut: 0,
    });
    expect(r.scenarios[0]!.thumbnailId).toBe(r.photos[0]!.id);
    expect(r.scenarios[0]!.createdAt).toBe(new Date(2026, 9, 7, 14, 32).getTime());
    expect(r.palette).toEqual({ tiles: ['#fff'], grouts: [] });
  });

  it('rien à importer', () => {
    expect(convertLegacy(EMPTY_STORAGE, 0)).toEqual({
      project: null,
      tiles: [],
      photos: [],
      scenarios: [],
      palette: null,
    });
  });
});

describe('fichiers et utilitaires', () => {
  it('export legacy : lecture et erreurs claires', () => {
    const data = { 'calepinage-v3': '{}', 'calepinage-nuancier': null };
    expect(parseLegacyExport(JSON.stringify({ format: LEGACY_EXPORT_FORMAT, version: 1, data }))).toEqual({
      ...EMPTY_STORAGE,
      'calepinage-v3': '{}',
    });
    expect(() => parseLegacyExport('pas du json')).toThrow(LegacyFileError);
    expect(() => parseLegacyExport('{"format":"autre"}')).toThrow(/pas un export/);
  });

  it('localStorage illisible : clés vides', () => {
    const ls = { getItem: (k: string) => (k === 'calepinage-v2' ? 'x' : (null as string | null)) };
    expect(readLocalStorage(ls)).toEqual({ ...EMPTY_STORAGE, 'calepinage-v2': 'x' });
    const broken = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
    };
    expect(readLocalStorage(broken)).toEqual(EMPTY_STORAGE);
  });

  it('dataURL → Blob', async () => {
    const b = dataUrlToBlob('data:text/plain;base64,' + btoa('bonjour'));
    expect(b.type).toBe('text/plain');
    expect(await b.text()).toBe('bonjour');
    expect(() => dataUrlToBlob('pas une image')).toThrow();
  });

  it('date fr-FR courte', () => {
    expect(parseFrDate('31/12/2025 09:05', 7)).toBe(new Date(2025, 11, 31, 9, 5).getTime());
    expect(parseFrDate('hier', 7)).toBe(7);
  });
});
