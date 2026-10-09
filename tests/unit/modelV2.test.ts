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
import { createSingleSurfaceProject } from '../../src/modules/carrelage/state/templates';
import { V1_ROOM, V1_WALL } from './fixtures/v1';

describe('migration v1 → v2 (documents figés)', () => {
  it('mur seul : plan vide, carrelage remis à vide (pas de conversion), réglages et prix gardés', () => {
    const { doc, changed } = migrateProject(V1_WALL);
    expect(changed).toBe(true);
    expect(doc).toEqual({
      schemaVersion: 2,
      id: 'p-mur',
      name: 'Mur 300 × 240',
      createdAt: 1700000000000,
      updatedAt: 1700000500000,
      plan: { rooms: [], passages: [] },
      modules: {
        carrelage: {
          schemaVersion: 2,
          data: { rooms: {}, settings: V1_WALL.settings, prices: { 'glue|kg': 12.5 } },
        },
      },
    });
  });

  it('pièce : une pièce rectangulaire du plan, nommée comme le projet, murs de 72 mm', () => {
    const { doc } = migrateProject(V1_ROOM);
    expect(doc.plan).toEqual({
      rooms: [
        {
          id: 'p-sdb:plan:0',
          name: 'Salle de bain',
          outline: [
            [0, 0],
            [2400, 0],
            [2400, 1800],
            [0, 1800],
          ],
          walls: [1, 2, 3, 4].map((n) => ({ id: `p-sdb:plan:${n}`, thickness: 72 })),
          obstacles: [],
          openings: [],
          height: 2500,
          origin: [0, 0],
        },
      ],
      passages: [],
    });
    expect(validatePlan(doc.plan)).toEqual([]);
    expect(carrelageView(doc)!.surfaces).toEqual([]);
  });

  it('déterministe et idempotente ; rien à carreler', () => {
    const a = migrateProject(V1_ROOM).doc;
    expect(migrateProject(V1_ROOM).doc).toEqual(a);
    expect(migrateProject(a)).toEqual({ doc: a, changed: false });
    expect(carrelage.toSpec(a, { tiles: [] })).toEqual({ errors: [{ code: 'carrelage/empty' }] });
  });

  it('données d’un module : version future refusée, module inconnu conservé', () => {
    const v2 = migrateProject(V1_WALL).doc;
    const future = { ...v2, modules: { carrelage: { schemaVersion: 9, data: {} } } };
    expect(() => migrateProject(future)).toThrow(FutureVersionError);
    const other = { ...v2, modules: { ...v2.modules, menuiserie: { schemaVersion: 4, data: { x: 1 } } } };
    expect(migrateProject(other)).toEqual({ doc: other, changed: false });
  });
});

describe('réducteur du projet', () => {
  const p = migrateProject(V1_ROOM).doc;
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
    expect(carrelageView(next)!.rooms).toBe(carrelageView(p)!.rooms);
    for (const a of [
      { type: 'project/rename', name: p.name },
      { type: 'carrelage/settings', patch: { margin: 10 } },
      { type: 'parquet/layout/update' },
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

  it('suppression d’une pièce : chaque module est prévenu', () => {
    const seen: unknown[] = [];
    const spy = {
      ...carrelage,
      reduce: (d: unknown, a: { type: string }) => (
        seen.push(a),
        a.type === 'plan/room/removed' ? { cleaned: true } : d
      ),
    } as unknown as ToolModule;
    const two = reduceProject(p, {
      type: 'plan/room/add',
      room: rectRoom(1000, 1000, { name: 'B' }, () => 'b' + seen.length),
    });
    const after = reduceProject(two, { type: 'plan/room/remove', roomId: room.id }, () => spy);
    expect(seen).toEqual([{ type: 'plan/room/removed', roomId: room.id }]);
    expect(after.modules.carrelage!.data).toEqual({ cleaned: true });
    expect(after.plan.rooms.map((r) => r.name)).toEqual(['B']);
  });
});

describe('contrat du module carrelage', () => {
  it('create : le sol de la première pièce du plan, sinon rien', () => {
    const p = migrateProject(V1_ROOM).doc;
    const data = carrelage.create(p.plan);
    expect(carrelageView(withCarrelage(p, data))!.surfaces).toMatchObject([
      { kind: 'floor', width: 2400, height: 1800, name: 'Salle de bain, sol' },
    ]);
    expect(carrelage.create({ rooms: [], passages: [] }).rooms).toEqual({});
  });

  it('toSpec, summary ; projet sans carrelage : erreur', () => {
    const tile = createTile({ id: 't1' });
    const layout = { tileId: tile.id, tileUpright: false, pattern: 'half' as const, angle: 0, joint: 3 };
    const p = createSingleSurfaceProject({ ...layout, kind: 'wall', width: 3000, height: 2400 });
    const r = carrelage.toSpec(p, { tiles: [tile] });
    if (!('spec' in r)) throw new Error('spec attendue');
    const s = carrelage.summary(computeProject(r.spec));
    expect(s.text).toMatch(/^\d+ carreaux, [\d,]+ m²$/);
    expect(s.alerts).toBeGreaterThanOrEqual(0);
    expect(carrelage.toSpec({ ...p, modules: {} }, {})).toEqual({ errors: [{ code: 'carrelage/absent' }] });
  });

  it('withCarrelage : même objet si les données sont les mêmes', () => {
    const p = migrateProject(V1_WALL).doc;
    expect(withCarrelage(p, carrelageView(p)! && (p.modules.carrelage!.data as never))).toBe(p);
  });
});
