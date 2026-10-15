/** Produits utilisés par un projet : un produit utilisé ne se supprime pas (contrat `LibraryDefinition.usedIn`). */
import { describe, expect, it } from 'vitest';
import { libraries } from '../../src/modules/registry';
import { computeCloisons } from '../../src/modules/cloisons/core/compute';
import { createSystem } from '../../src/modules/cloisons/core/defaults';
import { createCloisonsData } from '../../src/modules/cloisons/state/model';
import { toSpec as cloisonsSpec } from '../../src/modules/cloisons/state/module';
import { usesSystem } from '../../src/modules/cloisons/state/usage';
import { computePaint } from '../../src/modules/peinture/core/compute';
import { defaultPoseSettings } from '../../src/modules/peinture/core/defaults';
import { rectRegion } from '../../src/modules/peinture/core/surface';
import type { PaintSpec, SpecPaint } from '../../src/modules/peinture/core/types';
import type { PeintureData } from '../../src/modules/peinture/state/model';
import { usesPaint } from '../../src/modules/peinture/state/usage';
import type { ParquetData } from '../../src/modules/parquet/state/model';
import { usesBoard } from '../../src/modules/parquet/state/usage';
import type { CarrelageData } from '../../src/modules/carrelage/state/data';
import { usesTile } from '../../src/modules/carrelage/state/usage';
import type { Partition } from '../../src/core/plan/types';
import { hydrate, siteOf, type Project } from '../../src/state/model';
import { rect } from './planFixtures';

/** Projet d'une pièce, avec une pose du module `module` dont les réglages sont `settings`. */
function project(module: string, data: unknown, partitions: Partition[] = []): Project {
  const site = { ...siteOf({ rooms: [rect('a', 4000, 3000)], passages: [] } as never), partitions };
  return hydrate({
    schemaVersion: 4,
    id: 'p',
    name: 'Maison',
    createdAt: 0,
    updatedAt: 0,
    site,
    zones: [],
    poses: [{ id: 'P', module, name: 'Pose 1' }],
    modules: { [module]: { schemaVersion: 1, data } },
  } as never);
}

describe('produits utilisés', () => {
  it('chaque bibliothèque dit si un produit sert', () => {
    expect(libraries.map((l) => l.id).sort()).toEqual(['boards', 'paints', 'systems', 'tiles']);
    for (const l of libraries) expect(typeof l.usedIn).toBe('function');
  });

  it('lame : celle d’une pose de parquet', () => {
    const p = project('parquet', { poses: { P: { boardId: 'b1' } } } as unknown as ParquetData);
    expect(usesBoard(p, 'b1')).toBe(true);
    expect(usesBoard(p, 'b2')).toBe(false);
    // réglages d'une pose qui n'existe plus : ignorés
    expect(usesBoard({ ...p, poses: [] }, 'b1')).toBe(false);
  });

  it('peinture : finition, apprêt, enduit et boiseries', () => {
    const s = {
      ...defaultPoseSettings(),
      finish: 'f',
      primer: 'pr',
      filler: 'en',
      woodwork: { ...defaultPoseSettings().woodwork, finish: 'wf', primer: 'wp' },
    };
    const p = project('peinture', { poses: { P: s }, prices: {} } satisfies PeintureData);
    for (const id of ['f', 'pr', 'en', 'wf', 'wp']) expect(usesPaint(p, id)).toBe(true);
    expect(usesPaint(p, 'autre')).toBe(false);
  });

  it('carreau : celui d’une bande', () => {
    const p = project('carrelage', { poses: { P: { bands: [{ tileId: 't1' }] } } } as unknown as CarrelageData);
    expect(usesTile(p, 't1')).toBe(true);
    expect(usesTile(p, 't2')).toBe(false);
  });

  it('système : choisi, ou pris par défaut pour une cloison', () => {
    const q: Partition = { id: 'c1', a: [2000, 0], b: [2000, 3000], thickness: 72, openings: [] } as never;
    const systems = [createSystem('s72', 0, { name: '72/48' }), createSystem('s98', 0, { name: '98/48' })];
    const libs = { systems };
    const none = project('cloisons', createCloisonsData(), [q]);
    expect(usesSystem(none, 's72', libs)).toBe(true);
    const chosen = project('cloisons', { ...createCloisonsData(), partitions: { c1: { system: 's98' } } } as never, [
      q,
    ]);
    expect(usesSystem(chosen, 's98', libs)).toBe(true);
    expect(usesSystem(chosen, 's72', libs)).toBe(false);
  });
});

describe('produit retiré de la bibliothèque : signalé, jamais remplacé en silence', () => {
  const paint = (id: string, role: SpecPaint['role']): SpecPaint => ({
    id,
    name: id,
    role,
    uses: ['walls', 'woodwork'],
    yield: 10,
    coats: 2,
    packs: [{ size: 1, price: 10 }],
  });
  const spec = (paints: SpecPaint[]): PaintSpec => ({
    zones: [{ id: 'z', room: 'r', wall: 'w', region: rectRegion(0, 0, 4000, 2500), openings: [] }],
    wallLengths: { w: 4000 },
    floorArea: 12e6,
    paints: Object.fromEntries(paints.map((p) => [p.id, p])),
    prices: {},
    settings: { ...defaultPoseSettings(), support: 'plaster', finish: 'f', primer: 'pr' },
  });

  it('peinture : un apprêt supprimé lève product-missing', () => {
    expect(computePaint(spec([paint('f', 'finish'), paint('pr', 'primer')])).alerts).toEqual([]);
    const r = computePaint(spec([paint('f', 'finish')]));
    expect(r.alerts).toContainEqual({ code: 'product-missing', paint: 'pr', role: 'primer', target: 'walls' });
  });

  it('cloisons : un système choisi supprimé n’est pas remplacé (system-missing)', () => {
    const q: Partition = { id: 'c1', a: [2000, 0], b: [2000, 3000], thickness: 72, openings: [] } as never;
    const p = project('cloisons', { ...createCloisonsData(), partitions: { c1: { system: 'gone' } } } as never, [q]);
    const r = cloisonsSpec(p, { systems: [createSystem('s72', 0, { name: '72/48' })] });
    if ('errors' in r) throw new Error('attendu : une entrée');
    expect(r.spec.partitions[0]!.system).toBe('gone');
    expect(computeCloisons(r.spec).alerts.map((a) => a.code)).toContain('system-missing');
  });
});
