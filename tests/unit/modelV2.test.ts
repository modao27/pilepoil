import { describe, expect, it } from 'vitest';
import { validatePlan } from '../../src/core/plan/validate';
import { rectRoom } from '../../src/core/plan/factories';
import { module as carrelage } from '../../src/modules/carrelage';
import { computeProject } from '../../src/modules/carrelage/core';
import { carrelageView, withCarrelage } from '../../src/modules/carrelage/state/data';
import { createTile } from '../../src/modules/carrelage/state/factories';
import type { ToolModule } from '../../src/modules/types';
import type { Project } from '../../src/state/model';
import { reduceProject, type ProjectAction } from '../../src/state/project';
import { FutureVersionError, migrateProject } from '../../src/storage/migrations';
import { planProject, rect, wallOnly } from './planFixtures';

/** Projet de salle de bain 240 × 180, carrelage activé sans surface. */
const bathroom = (): Project => planProject([rect('sdb', 2400, 1800, { name: 'Salle de bain', height: 2500 })]);

describe('migrations du projet', () => {
  it('projet v1 (avant la boîte à outils) : refusé, sans conversion', () => {
    expect(() => migrateProject({ schemaVersion: 1, id: 'x', surfaces: [], room: null })).toThrow(
      /Migration manquante/,
    );
  });

  it('anciennes données du carrelage (avant les zones et poses) : refusées, sans conversion', () => {
    const old = { ...bathroom(), modules: { carrelage: { schemaVersion: 2, data: { rooms: {} } } } };
    expect(() => migrateProject(old)).toThrow(/Migration manquante/);
    expect(validatePlan(bathroom().plan)).toEqual([]);
  });

  it('données d’un module : version future refusée, module inconnu conservé', () => {
    const v2 = bathroom();
    const future = { ...v2, modules: { carrelage: { schemaVersion: 9, data: {} } } };
    expect(() => migrateProject(future)).toThrow(FutureVersionError);
    const other = { ...v2, modules: { ...v2.modules, menuiserie: { schemaVersion: 4, data: { x: 1 } } } };
    expect(migrateProject(other)).toEqual({ doc: other, changed: false });
  });
});

describe('réducteur du projet', () => {
  const p = bathroom();
  const room = p.plan.rooms[0]!;

  it('aiguille plan, carrelage, renommage et groupes ; inchangé = même objet', () => {
    const next = reduceProject(p, {
      type: 'batch',
      actions: [
        { type: 'project/rename', name: 'SdB' },
        { type: 'plan/room/update', roomId: room.id, patch: { height: 2600 } },
        { type: 'carrelage/settings', patch: { margin: 15 } } as ProjectAction,
      ],
    });
    expect(next.name).toBe('SdB');
    expect(next.plan.rooms[0]!.height).toBe(2600);
    expect(carrelageView(next)!.settings.margin).toBe(15);
    expect(carrelageView(next)!.poses).toBe(carrelageView(p)!.poses);
    for (const a of [
      { type: 'project/rename', name: p.name },
      { type: 'carrelage/settings', patch: { margin: 10 } },
      { type: 'parquet/pose/update' },
      { type: 'plan/room/update', roomId: 'inconnue', patch: { height: 1 } },
    ] as ProjectAction[])
      expect(reduceProject(p, a)).toBe(p);
  });

  it('activer un outil : données créées hors du réducteur, une seule fois', () => {
    const bare: Project = { ...p, modules: {} };
    const doc = { schemaVersion: 1, data: carrelage.create(p.plan) };
    const on = reduceProject(bare, { type: 'project/module/add', id: 'carrelage', doc });
    expect(on.modules.carrelage).toBe(doc);
    expect(
      reduceProject(on, { type: 'project/module/add', id: 'carrelage', doc: { schemaVersion: 1, data: {} } }),
    ).toBe(on);
  });

  it('module absent du projet : action ignorée', () => {
    const bare: Project = { ...p, modules: {} };
    expect(reduceProject(bare, { type: 'carrelage/settings', patch: { margin: 15 } } as ProjectAction)).toBe(bare);
  });

  it('suppression d’une pièce : ses zones partent, le module de chaque pose vidée est prévenu', () => {
    const seen: unknown[] = [];
    const spy = {
      ...carrelage,
      reduce: (d: unknown, a: { type: string }) => (seen.push(a), a.type === 'pose/removed' ? { cleaned: true } : d),
    } as unknown as ToolModule;
    const two = reduceProject(p, {
      type: 'plan/room/add',
      room: rectRoom(1000, 1000, { name: 'B' }, () => 'b' + seen.length),
    });
    const tiled: Project = {
      ...two,
      zones: [{ id: 'z', surface: { room: room.id, wall: null }, cuts: [], pose: 'P' }],
      poses: [{ id: 'P', module: 'carrelage', name: 'Pose 1' }],
    };
    const after = reduceProject(tiled, { type: 'plan/room/remove', roomId: room.id }, () => spy);
    expect(seen).toEqual([{ type: 'pose/removed', poseId: 'P' }]);
    expect([after.zones, after.poses]).toEqual([[], []]);
    expect(after.modules.carrelage!.data).toEqual({ cleaned: true });
    expect(after.plan.rooms.map((r) => r.name)).toEqual(['B']);
  });
});

describe('contrat du module carrelage', () => {
  it('create : aucune pose (elles naissent des zones) ; createPose : réglages d’une nouvelle pose', () => {
    const p = bathroom();
    const data = carrelage.create(p.plan);
    expect(data.poses).toEqual({});
    expect(carrelageView(withCarrelage(p, data))!.surfaces).toEqual([]);
    const tile = createTile({ id: 't9' });
    expect(carrelage.createPose(p, { tiles: [tile] })).toMatchObject({ joint: 3, bands: [{ tileId: 't9' }] });
  });

  it('toSpec, summary ; projet sans carrelage : erreur', () => {
    const tile = createTile({ id: 't1' });
    const layout = { tileId: tile.id, tileUpright: false, pattern: 'half' as const, angle: 0, joint: 3 };
    const p = wallOnly(layout, 3000, 2400);
    const r = carrelage.toSpec(p, { tiles: [tile] });
    if (!('spec' in r)) throw new Error('spec attendue');
    const s = carrelage.summary(computeProject(r.spec));
    expect(s.text).toMatch(/^\d+ carreaux, [\d,]+ m²$/);
    expect(s.alerts).toBeGreaterThanOrEqual(0);
    expect(carrelage.toSpec({ ...p, modules: {} }, {})).toEqual({ errors: [{ code: 'carrelage/absent' }] });
  });

  it('withCarrelage : même objet si les données sont les mêmes', () => {
    const p = bathroom();
    expect(withCarrelage(p, carrelageView(p)! && (p.modules.carrelage!.data as never))).toBe(p);
  });
});

describe('zones et poses dans le projet', () => {
  /** Module factice : garde les réglages par pose, comme le feront carrelage et parquet. */
  const fake = {
    ...carrelage,
    coverage: { surfaces: ['floor', 'wall'], extent: 'surface' },
    reduce: (d: { poses: Record<string, unknown> }, a: { type: string; poseId?: string; settings?: unknown }) => {
      if (a.type === 'pose/added') return { poses: { ...d.poses, [a.poseId!]: a.settings } };
      if (a.type === 'pose/removed') {
        const { [a.poseId!]: _, ...rest } = d.poses;
        return { poses: rest };
      }
      return d;
    },
  } as unknown as ToolModule;
  const find = () => fake;
  const room = rect('r', 3000, 2000);
  const p0: Project = {
    ...planProject([room]),
    modules: { carrelage: { schemaVersion: 9, data: { poses: {} } } },
  };
  const add: ProjectAction = {
    type: 'pose/add',
    pose: { id: 'p1', module: 'carrelage', name: 'Pose 1' },
    zones: [{ id: 'z1', surface: { room: 'r', wall: null }, cuts: [], pose: 'p1' }],
    settings: { joint: 3 },
  };

  it('les réglages arrivent avec la pose et partent avec elle', () => {
    const p1 = reduceProject(p0, add, find);
    expect(p1.poses).toEqual([{ id: 'p1', module: 'carrelage', name: 'Pose 1' }]);
    expect(p1.modules.carrelage!.data).toEqual({ poses: { p1: { joint: 3 } } });
    const p2 = reduceProject(p1, { type: 'zone/remove', zoneId: 'z1' }, find);
    expect(p2.poses).toEqual([]);
    expect(p2.modules.carrelage!.data).toEqual({ poses: {} });
  });

  it('pièce supprimée : ses zones et ses poses partent ; règle enfreinte : rien ne change', () => {
    const p1 = reduceProject(p0, add, find);
    const gone = reduceProject(p1, { type: 'plan/room/remove', roomId: 'r' }, find);
    expect([gone.zones, gone.poses, gone.modules.carrelage!.data]).toEqual([[], [], { poses: {} }]);
    const overlap: ProjectAction = {
      type: 'zone/add',
      zone: { id: 'z2', surface: { room: 'r', wall: null }, cuts: [], pose: 'p1' },
    };
    expect(reduceProject(p1, overlap, find)).toBe(p1);
  });
});
