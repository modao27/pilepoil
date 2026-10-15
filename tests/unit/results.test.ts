/**
 * Résultats par pose, pièce et projet (docs/NAVIGATION.md §7) : portée, rapports des deux modules (pièces exactes
 * sur la portée, quantités honnêtes), placement 3D au repère du plan, PDF aux trois niveaux.
 */
import { NO_CONTEXT } from '../../src/core/coverage/wallBase';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { poseWhere, type Zone } from '../../src/core/coverage';
import {
  poseArea,
  poseBeyond,
  scopePoses,
  scopeRooms,
  scopeWallSpans,
  type ResultScope,
} from '../../src/core/coverage/scope';
import type { Plan } from '../../src/core/plan/types';
import { computeProject, type ProjectResult } from '../../src/modules/carrelage/core';
import { buildMeshes } from '../../src/modules/carrelage/render/scene3d/meshes';
import { planLayouts } from '../../src/modules/carrelage/render/scene3d/scope';
import { CARRELAGE_SCHEMA } from '../../src/modules/carrelage/state/data';
import { createData, createPoseSettings, createTile } from '../../src/modules/carrelage/state/factories';
import { pieceRoom, scopePieces } from '../../src/modules/carrelage/state/results';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { writeTilingResults } from '../../src/modules/carrelage/ui/lib/pdf';
import { tilingReport } from '../../src/modules/carrelage/ui/lib/results';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { ParquetResult } from '../../src/modules/parquet/core/types';
import {
  createParquetData,
  createPoseSettings as createParquetPose,
  PARQUET_SCHEMA,
} from '../../src/modules/parquet/state/model';
import { writeParquetResults } from '../../src/modules/parquet/ui/lib/pdf';
import { parquetReport } from '../../src/modules/parquet/ui/lib/results';
import { moduleById } from '../../src/modules/registry';
import type { Libraries, ModuleResults, ResultExports } from '../../src/modules/types';
import { PROJECT_SCHEMA, siteOf, type Project } from '../../src/state/model';
import { buildResultsPdf } from '../../src/ui/lib/resultsPdf';
import { consolidate } from '../../src/ui/lib/shopping';
import { rect, view, withOpening } from './planFixtures';

const tile = createTile({ length: 300, width: 300, pricePerM2: 20 });
const libraries: Libraries = { tiles: [tile], boards: BOARD_TEMPLATES };

/** Séjour 4 × 3 m et Bureau 3 × 3 m, mur de 72 mm, portes de 83 cm face à face. */
function twoRooms(): Plan {
  const a = withOpening(rect('a', 4000, 3000, { name: 'Séjour' }), 1, {
    id: 'da',
    kind: 'door',
    offset: 1000,
    width: 830,
    sill: 0,
    height: 2040,
  });
  const b = {
    ...withOpening(rect('b', 3000, 3000, { name: 'Bureau' }), 3, {
      id: 'db',
      kind: 'door',
      offset: 1170,
      width: 830,
      sill: 0,
      height: 2040,
    }),
    origin: [4072, 0] as [number, number],
  };
  return { rooms: [a, b], passages: [{ id: 'P', a: { room: 'a', opening: 'da' }, b: { room: 'b', opening: 'db' } }] };
}

const zone = (id: string, pose: string, room: string, wall: string | null = null): Zone => ({
  id,
  pose,
  surface: { room, wall },
  cuts: [],
});

/**
 * Projet avec les deux revêtements : Séjour carrelé au sol (T1) et sur le mur 1 (T2, même carreau), Bureau en
 * parquet (P). `linked` : une seule pose de carrelage sur les deux sols, sans parquet.
 */
function project(linked = false): Project {
  const parquet = createParquetData();
  parquet.poses.P = createParquetPose();
  const zones = linked
    ? [zone('z1', 'S', 'a'), zone('z2', 'S', 'b')]
    : [zone('z1', 'T1', 'a'), zone('z2', 'T2', 'a', 'a-w0'), zone('z3', 'P', 'b')];
  const tilePoses = linked ? ['S'] : ['T1', 'T2'];
  const site = siteOf(twoRooms());
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: 'p',
    name: 'Maison',
    createdAt: 0,
    updatedAt: 0,
    site,
    plan: site.existing,
    zones,
    poses: [
      ...tilePoses.map((id, i) => ({ id, module: 'carrelage', name: `Pose ${i + 1}` })),
      ...(linked ? [] : [{ id: 'P', module: 'parquet', name: 'Pose 3' }]),
    ],
    modules: {
      carrelage: {
        schemaVersion: CARRELAGE_SCHEMA,
        data: createData({ poses: Object.fromEntries(tilePoses.map((id) => [id, createPoseSettings(tile.id)])) }),
      },
      ...(linked ? {} : { parquet: { schemaVersion: PARQUET_SCHEMA, data: parquet } }),
    },
  };
}

const tilingResult = (p: Project): ProjectResult => computeProject(toProjectSpec(view(p), [tile]).spec);
function parquetResult(p: Project): ParquetResult {
  const s = moduleById('parquet')!.toSpec(p, libraries, NO_CONTEXT);
  if (!('spec' in s)) throw new Error('spec');
  return computeParquet(s.spec as Parameters<typeof computeParquet>[0]);
}

const ROOM_A: ResultScope = { kind: 'room', room: 'a' };
const ROOM_B: ResultScope = { kind: 'room', room: 'b' };
const PROJECT: ResultScope = { kind: 'project' };

describe('portée des résultats', () => {
  const p = project();

  it('poses, pièces et murs touchés', () => {
    expect(scopePoses(p, PROJECT).map((x) => x.id)).toEqual(['T1', 'T2', 'P']);
    expect(scopePoses(p, ROOM_A).map((x) => x.id)).toEqual(['T1', 'T2']);
    expect(scopePoses(p, { kind: 'pose', pose: 'P' }).map((x) => x.id)).toEqual(['P']);
    expect(scopeRooms(p.plan, p, { kind: 'pose', pose: 'T2' })).toEqual(['a']);
    expect(scopeRooms(p.plan, p, PROJECT)).toEqual(['a', 'b']);
    expect([...scopeWallSpans(p.plan, p, ROOM_A)]).toEqual([['a-w0', [[0, 4000]]]]);
    expect([...scopeWallSpans(p.plan, p, ROOM_B)]).toEqual([]);
  });

  it('surface revêtue d’une pose dans la portée ; pose qui sort de la pièce', () => {
    expect(poseArea(p.plan, p, 'T1', PROJECT) / 1e6).toBeCloseTo(12, 6);
    expect(poseArea(p.plan, p, 'T1', ROOM_B)).toBe(0);
    const l = project(true);
    expect(poseArea(l.plan, l, 'S', ROOM_A) / 1e6).toBeCloseTo(12, 6);
    expect(poseArea(l.plan, l, 'S', PROJECT) / 1e6).toBeCloseTo(21, 6);
    expect(poseBeyond(l, 'S', ROOM_A)).toBe(true);
    expect(poseBeyond(l, 'S', PROJECT)).toBe(false);
    expect(poseBeyond(p, 'T1', ROOM_A)).toBe(false);
  });

  it('où est une pose', () => {
    expect(poseWhere(p.plan, p.zones, 'T1')).toBe('Séjour, sol');
    expect(poseWhere(p.plan, p.zones, 'T2')).toBe('Séjour, mur 1');
    const l = project(true);
    expect(poseWhere(l.plan, l.zones, 'S')).toBe('Séjour + Bureau, sol');
    expect(poseWhere(l.plan, l.zones, 'S', 'b')).toBe('Bureau, sol');
  });
});

describe('rapport du carrelage', () => {
  it('sol sur deux pièces : chaque carreau dans une seule pièce, les deux pièces font la pose', () => {
    const p = project(true);
    const r = tilingResult(p);
    const a = scopePieces(view(p), r, ROOM_A),
      b = scopePieces(view(p), r, ROOM_B),
      all = scopePieces(view(p), r, PROJECT);
    expect(a.size).toBeGreaterThan(0);
    expect(b.size).toBeGreaterThan(0);
    expect([...a].filter((i) => b.has(i))).toEqual([]);
    expect(a.size + b.size).toBe(all.size);
    // le Séjour (12 m²) a plus de carreaux que le Bureau (9 m²)
    expect(a.size).toBeGreaterThan(b.size);

    const [ra] = tilingReport({ project: p, libraries, result: r, scope: ROOM_A });
    const [rb] = tilingReport({ project: p, libraries, result: r, scope: ROOM_B });
    const [rp] = tilingReport({ project: p, libraries, result: r, scope: PROJECT });
    const posed = (x: typeof ra) => Number(x!.figures[0]!.value.replace(/\s/g, ''));
    expect(posed(ra) + posed(rb)).toBe(posed(rp));
    // la commande est celle de la pose, la même aux trois niveaux, dite « pour toute la pose » dans une pièce
    expect(ra!.order).toEqual(rp!.order);
    expect(ra!.orderNote).toMatch(/toute la pose/);
    expect(rp!.orderNote).toBeNull();
  });

  it('carreau partagé par deux poses : commande du projet, dite comme telle', () => {
    const p = project();
    const r = tilingResult(p);
    const reports = tilingReport({ project: p, libraries, result: r, scope: ROOM_A });
    expect(reports.map((x) => x.pose)).toEqual(['T1', 'T2']);
    for (const x of reports) {
      expect(x.ok).toBe(true);
      expect(x.order[0]).toMatch(/carreaux 30 × 30 cm/);
      expect(x.orderNote).toMatch(/tout le projet/);
    }
    expect(tilingReport({ project: p, libraries, result: r, scope: ROOM_B })).toEqual([]);
  });

  it('3D au repère du plan : sol à l’origine de sa pièce, pose de mur depuis le début de son mur', () => {
    const p = project();
    const v = view(p);
    const spec = toProjectSpec(v, [tile]).spec;
    const [lay] = planLayouts(p.plan, v.surfaces, spec, [0, 1]);
    expect(lay!.instances.map((i) => i.kind)).toEqual(['floor', 'wall']);
    expect(lay!.instances[0]).toMatchObject({ kind: 'floor', origin: [0, 0] });
    const w = lay!.instances[1]!;
    expect(w.kind === 'wall' && w.frames[0]!.base).toEqual([0, 0]);
    expect(lay!.room).toMatchObject({ outline: [], bare: [], caps: [], height: 2.5 });
    // le Bureau n'a pas de carrelage
    expect(planLayouts(p.plan, v.surfaces, spec, [0, 1])).toHaveLength(1);
    const l = project(true);
    const lv = view(l);
    const [only] = planLayouts(l.plan, lv.surfaces, toProjectSpec(lv, [tile]).spec, [0]);
    expect(only!.instances).toHaveLength(1);
  });
});

describe('3D d’une pièce : sol continu rogné à la pièce', () => {
  it('la pose sur deux sols montrée dans le Bureau : chape, joints et carreaux dans le Bureau seulement', () => {
    const p = project(true);
    const v = view(p);
    const spec = toProjectSpec(v, [tile]).spec;
    const result = tilingResult(p);
    const [layout] = planLayouts(p.plan, v.surfaces, spec, [0]);
    const s = v.surfaces[0]!;
    const part = s.parts.find((x) => x.ref.room === 'b')!;
    const b = p.plan.rooms.find((r) => r.id === 'b')!;
    const base = { spec, result, layout: layout!, shade: 0, photo: () => null, context: false };
    const whole = buildMeshes(base);
    const clipped = buildMeshes({
      ...base,
      clip: {
        0: {
          region: [b.outline.map((q): [number, number] => [q[0] - part.x, q[1] - part.y])],
          keep: (pc) => pieceRoom(p.plan, s, pc) === 'b',
        },
      },
    });
    const xs = (ms: typeof whole, key: string) => {
      const m = ms.find((x) => x.key.startsWith(key))!;
      return m.positions.filter((_, i) => i % 3 === 0);
    };
    // le Bureau commence à x = 4,072 m ; un carreau à cheval sur la porte peut dépasser d'un carreau (30 cm)
    expect(Math.min(...xs(whole, 'floorbase'))).toBeLessThan(1);
    expect(Math.min(...xs(clipped, 'floorbase'))).toBeGreaterThanOrEqual(4.072 - 1e-6);
    expect(Math.min(...xs(clipped, 'grout'))).toBeGreaterThanOrEqual(4.072 - 1e-6);
    expect(Math.min(...xs(clipped, 'tiles'))).toBeGreaterThan(4.072 - 0.3);
    expect(xs(clipped, 'tiles').length).toBeLessThan(xs(whole, 'tiles').length);
  });
});

describe('rapport du parquet', () => {
  it('pose sur une pièce : lames posées, coupées, paquets de la pose', () => {
    const p = project();
    const r = parquetResult(p);
    const [rep] = parquetReport({ project: p, libraries, result: r, scope: ROOM_B });
    expect(rep!.pose).toBe('P');
    expect(rep!.ok).toBe(true);
    expect(rep!.figures.map((f) => f.label)).toEqual([
      'Lames posées',
      'Lames coupées',
      'Dans les chutes',
      'Perte de la pose',
    ]);
    expect(rep!.order[0]).toMatch(/^\d+ paquets? .+ : \d+ lames? \+ \d+ %$/);
    expect(rep!.orderNote).toBeNull();
    expect(parquetReport({ project: p, libraries, result: r, scope: ROOM_A })).toEqual([]);
  });
});

async function pagesText(blob: Blob): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((x) => ('str' in x ? x.str : '')).join(' '));
  }
  return out;
}

describe('PDF des résultats', () => {
  const p = project();
  const tiling = { module: moduleById('carrelage')!, result: tilingResult(p) as unknown };
  const parquet = { module: moduleById('parquet')!, result: parquetResult(p) as unknown };
  const ex = (pdf: ResultExports['pdf']): ResultExports => ({ pdf, meshes: () => [] });
  const report = (r: ModuleResults['report']) => ({ report: r }) as ModuleResults;
  const entries = [
    {
      ...tiling,
      results: report(tilingReport as ModuleResults['report']),
      exports: ex(writeTilingResults as ResultExports['pdf']),
    },
    {
      ...parquet,
      results: report(parquetReport as ModuleResults['report']),
      exports: ex(writeParquetResults as ResultExports['pdf']),
    },
  ];
  const lines = [
    ...tiling.module.shopping(tiling.result, p.modules.carrelage!.data, libraries, p),
    ...parquet.module.shopping(parquet.result, p.modules.parquet!.data, libraries, p),
  ];
  const build = (scope: ResultScope, title: string, shopping = false) =>
    buildResultsPdf({
      project: p,
      libraries,
      scope,
      title,
      entries,
      shopping: shopping ? consolidate(lines) : null,
      date: Date.UTC(2026, 9, 12),
    });

  it('pose : son résumé et les pages de son revêtement seulement', async () => {
    const pages = await pagesText(build({ kind: 'pose', pose: 'T2' }, 'PDF du calepinage — Séjour, mur 1'));
    const all = pages.join('\n');
    expect(pages[0]).toMatch(/PDF du calepinage — Séjour, mur 1/);
    expect(pages[0]).toMatch(/Carrelage · Pose 2/);
    expect(all).toMatch(/Plan coté — Séjour, mur 1/);
    expect(all).not.toMatch(/Plan coté — Séjour, sol/);
    expect(all).not.toMatch(/Parquet/);
    expect(all).not.toMatch(/Liste d.achat/);
  });

  it('pièce : les poses de la pièce, tous revêtements', async () => {
    const a = (await pagesText(build(ROOM_A, 'PDF de la pièce — Séjour'))).join('\n');
    expect(a).toMatch(/Plan coté — Séjour, sol/);
    expect(a).toMatch(/Plan coté — Séjour, mur 1/);
    expect(a).not.toMatch(/Fiche de coupe/);
    const b = (await pagesText(build(ROOM_B, 'PDF de la pièce — Bureau'))).join('\n');
    expect(b).toMatch(/Parquet/);
    expect(b).toMatch(/Fiche de coupe/);
    expect(b).not.toMatch(/Plan de découpe/);
  });

  it('dossier du projet : plan d’ensemble, résumé par pièce, tous les revêtements, achats', async () => {
    const pages = await pagesText(build(PROJECT, 'Dossier du projet', true));
    const all = pages.join('\n');
    expect(pages[0]).toMatch(/Dossier du projet/);
    expect(pages[0]).toMatch(/Séjour/);
    expect(pages[0]).toMatch(/Bureau/);
    expect(all).toMatch(/Plan de découpe/);
    expect(all).toMatch(/Fiche de coupe/);
    expect(all).toMatch(/Liste d.achat du projet/);
    expect(all).toMatch(/Total estimé/);
    expect(pages.at(-1)).toMatch(new RegExp(`${pages.length} / ${pages.length}`));
  });
});
