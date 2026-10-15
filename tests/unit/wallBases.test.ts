/**
 * Pied des murs lu d'un outil à l'autre (docs/BOITE.md §2) : le parquet et le carrelage disent leurs plinthes et
 * leurs murs carrelés depuis le sol ; la peinture retire la bande des plinthes et ne peint que les plinthes
 * peignables ; le parquet ne pose pas de plinthe le long d'un mur carrelé.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { wallSpanCuts } from '../../src/core/coverage/geometry';
import type { Zone } from '../../src/core/coverage/types';
import {
  floorSpans,
  NO_CONTEXT,
  spansAtFloor,
  subtractSpans,
  type ProjectContext,
} from '../../src/core/coverage/wallBase';
import type { Plan } from '../../src/core/plan/types';
import { createPoseSettings as tilePose, createTile } from '../../src/modules/carrelage/state/factories';
import { wallBases as tileBases } from '../../src/modules/carrelage/state/module';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { createParquetData, createPoseSettings, PARQUET_SCHEMA } from '../../src/modules/parquet/state/model';
import { toSpec as parquetSpec, wallBases as woodBases } from '../../src/modules/parquet/state/module';
import { computePaint } from '../../src/modules/peinture/core/compute';
import { defaultPoseSettings } from '../../src/modules/peinture/core/defaults';
import { PAINT_TEMPLATES } from '../../src/modules/peinture/core/paint';
import type { PaintPoseSettings, PeintureSpec } from '../../src/modules/peinture/core/types';
import { PEINTURE_SCHEMA } from '../../src/modules/peinture/state/model';
import { toSpec as paintSpec } from '../../src/modules/peinture/state/module';
import { loadModules } from '../../src/modules/registry';
import type { Project } from '../../src/state/model';
import { projectContext } from '../../src/ui/lib/projectContext';
import { planProject, rect, withOpening } from './planFixtures';

const tile = createTile({ length: 300, width: 300 });
const libraries = { tiles: [tile], boards: BOARD_TEMPLATES, paints: PAINT_TEMPLATES };

/** Pièce 4 000 × 3 000, hauteur 2 500, porte de 830 sur le mur 0 à 500 du début. */
const plan = (): Plan => ({
  rooms: [
    withOpening(rect('r', 4000, 3000, { height: 2500 }), 0, {
      kind: 'door',
      offset: 500,
      width: 830,
      sill: 0,
      height: 2040,
    }),
  ],
  passages: [],
});
const w = (i: number) => `r-w${i}`;

/**
 * Parquet au sol (plinthes de 60), crédence carrelée du sol à 1 200 sur le mur 2, peinture sur les murs 0, 1, 3 et le
 * haut du mur 2. `floor` : le sol est du carrelage (plinthe carrelée de 80) au lieu du parquet.
 */
function project(o: { floor?: 'parquet' | 'carrelage'; paint?: Partial<PaintPoseSettings> } = {}): Project {
  const p = plan();
  const z = (id: string, wall: string | null, pose: string, cuts: Zone['cuts'] = []): Zone => ({
    id,
    surface: { room: 'r', wall },
    cuts,
    pose,
  });
  const floorTile = o.floor === 'carrelage';
  const zones: Zone[] = [
    z('zf', null, floorTile ? 'CS' : 'PQ'),
    z('zc', w(2), 'CT', wallSpanCuts(p, { room: 'r', wall: w(2) }, null, 1200)),
    z('z0', w(0), 'PP'),
    z('z1', w(1), 'PP'),
    z('z3', w(3), 'PP'),
    z('z2', w(2), 'PP', wallSpanCuts(p, { room: 'r', wall: w(2) }, 1200, null)),
  ];
  const parquet = createParquetData();
  if (!floorTile) parquet.poses.PQ = createPoseSettings({ boardId: BOARD_TEMPLATES[0]!.id });
  const paint: PaintPoseSettings = { ...defaultPoseSettings(), finish: PAINT_TEMPLATES[0]!.id, ...o.paint };
  const base = planProject(
    p.rooms,
    {
      poses: {
        CT: tilePose(tile.id),
        ...(floorTile ? { CS: tilePose(tile.id, { plinth: { length: 12000, height: 80, bandId: 'b' } }) } : {}),
      },
    },
    {
      plan: p,
      zones,
      poses: [
        floorTile ? { id: 'CS', module: 'carrelage', name: 'Sol' } : { id: 'PQ', module: 'parquet', name: 'Parquet' },
        { id: 'CT', module: 'carrelage', name: 'Crédence' },
        { id: 'PP', module: 'peinture', name: 'Peinture' },
      ],
    },
  );
  return {
    ...base,
    modules: {
      ...base.modules,
      ...(floorTile ? {} : { parquet: { schemaVersion: PARQUET_SCHEMA, data: parquet } }),
      peinture: { schemaVersion: PEINTURE_SCHEMA, data: { poses: { PP: paint }, prices: {} } },
    },
  };
}

const ctx = (p: Project): ProjectContext => projectContext(p, libraries);
const paintOf = (p: Project, c: ProjectContext) => {
  const r = paintSpec(p, libraries, c);
  if ('errors' in r) throw new Error(JSON.stringify(r.errors));
  return computePaint((r.spec as PeintureSpec).poses[0]!.spec);
};

beforeAll(() => loadModules());

describe('intervalles', () => {
  it('pied d’un mur moins ses portes ; différence d’intervalles ; contact avec le sol', () => {
    const room = plan().rooms[0]!;
    expect(floorSpans(room, 0)).toEqual([
      [0, 500],
      [1330, 4000],
    ]);
    expect(floorSpans(room, 1)).toEqual([[0, 3000]]);
    expect(
      subtractSpans(
        [[0, 10]],
        [
          [2, 3],
          [9, 12],
        ],
      ),
    ).toEqual([
      [0, 2],
      [3, 9],
    ]);
    const p = plan();
    expect(
      spansAtFloor([
        [
          [0, 0],
          [4000, 0],
          [4000, 1200],
          [0, 1200],
        ],
      ]),
    ).toEqual([[0, 4000]]);
    expect(
      spansAtFloor([
        [
          [0, 1200],
          [4000, 1200],
          [4000, 2500],
          [0, 2500],
        ],
      ]),
    ).toEqual([]);
    expect(p.rooms).toHaveLength(1);
  });
});

describe('ce que chaque outil dit du pied des murs', () => {
  it('parquet : plinthe peignable de 60 sur tous les murs, porte retirée ; sans plinthe : sol nu', () => {
    const p = project();
    const b = woodBases(p);
    expect(b.filter((x) => x.wall === w(0)).map((x) => [x.from, x.to])).toEqual([
      [0, 500],
      [1330, 4000],
    ]);
    expect(b.every((x) => x.kind === 'skirting' && x.height === 60 && x.paintable)).toBe(true);
    const d = p.modules.parquet!.data as ReturnType<typeof createParquetData>;
    const off = { ...d, accessories: { ...d.accessories, skirting: { ...d.accessories.skirting, enabled: false } } };
    const q = { ...p, modules: { ...p.modules, parquet: { schemaVersion: PARQUET_SCHEMA, data: off } } };
    expect(woodBases(q).every((x) => x.kind === 'bare')).toBe(true);
  });

  it('carrelage : crédence posée au sol = mur carrelé ; sol carrelé avec plinthe = plinthe non peignable', () => {
    const p = project();
    expect(tileBases(p)).toEqual([
      { room: 'r', wall: w(2), from: 0, to: 4000, kind: 'tiled', height: 1200, paintable: false, module: 'carrelage' },
    ]);
    const s = project({ floor: 'carrelage' });
    const sk = tileBases(s).filter((x) => x.kind === 'skirting');
    expect(sk).toHaveLength(5);
    expect(sk.every((x) => x.height === 80 && !x.paintable)).toBe(true);
  });
});

describe('les outils se lisent', () => {
  it('parquet : pas de plinthe le long de la crédence carrelée', () => {
    const p = project();
    const alone = parquetSpec(p, libraries, NO_CONTEXT);
    const read = parquetSpec(p, libraries, ctx(p));
    if ('errors' in alone || 'errors' in read) throw new Error('attendu : une entrée');
    const length = (s: typeof read.spec) => computeParquet(s).skirting.pieces.reduce((t, x) => t + x.length, 0);
    expect(length(alone.spec)).toBeCloseTo(14000 - 830, 6);
    expect(length(read.spec)).toBeCloseTo(14000 - 830 - 4000, 6);
  });

  it('peinture : bande des plinthes du parquet retirée, plinthes peintes sur la longueur du parquet', () => {
    const p = project({ paint: { woodwork: { ...defaultPoseSettings().woodwork, skirting: true } } });
    const r = paintOf(p, ctx(p));
    // murs 0, 1, 3 au sol (porte retirée) ; le haut du mur 2 ne touche pas le sol
    const length = 3170 + 3000 + 3000;
    expect(r.areas.skirting).toBeCloseTo((length * 60) / 1e6, 6);
    expect(r.areas.net).toBeCloseTo(r.areas.gross - r.areas.openings - r.areas.skirting, 9);
    expect(r.woodwork.skirtingLength).toBeCloseTo(length / 1000, 6);
    expect(r.woodwork.skirting).toBeCloseTo((length * 60) / 1e6, 6);
  });

  it('peinture : plinthe carrelée retirée de la surface mais jamais peinte', () => {
    const p = project({
      floor: 'carrelage',
      paint: { woodwork: { ...defaultPoseSettings().woodwork, skirting: true } },
    });
    const r = paintOf(p, ctx(p));
    expect(r.areas.skirting).toBeCloseTo(((3170 + 6000) * 80) / 1e6, 6);
    expect(r.woodwork.skirtingLength).toBe(0);
  });

  it('peinture : sol non revêtu dans l’application, réglage manuel en secours (bande et plinthes)', () => {
    const p = project({
      paint: { woodwork: { ...defaultPoseSettings().woodwork, skirting: true, skirtingHeight: 100 } },
    });
    const r = paintOf(p, NO_CONTEXT);
    expect(r.areas.skirting).toBeCloseTo(((3170 + 6000) * 100) / 1e6, 6);
    expect(r.woodwork.skirtingLength).toBeCloseTo(9.17, 6);
    const none = paintOf(project(), NO_CONTEXT);
    expect(none.areas.skirting).toBe(0);
  });
});
