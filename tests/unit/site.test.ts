import { describe, expect, it } from 'vitest';
import { zoneArea } from '../../src/core/coverage';
import { planAfter } from '../../src/core/plan/derive';
import type { Partition } from '../../src/core/plan/types';
import { dehydrate, hydrate, siteOf, type Project } from '../../src/state/model';
import { reduceProject, type ProjectAction } from '../../src/state/project';
import { createProjectStore } from '../../src/state/store';
import { migrateProject } from '../../src/storage/migrations';
import { rect } from './planFixtures';

const room = rect('a', 4000, 3000);
const cloison: Partition = {
  id: 'c1',
  a: [2000, 0],
  b: [2000, 3000],
  thickness: 72,
  align: 'center',
  openings: [],
};

function project(): Project {
  const site = siteOf({ rooms: [room], passages: [] });
  return {
    schemaVersion: 4,
    id: 'p',
    name: 'Maison',
    createdAt: 0,
    updatedAt: 0,
    site,
    plan: planAfter(site),
    zones: [{ id: 'z', surface: { room: 'a', wall: null }, cuts: [], pose: 'P' }],
    poses: [{ id: 'P', module: 'carrelage', name: 'Pose 1' }],
    modules: {},
  };
}

describe('migration 3 → 4', () => {
  const v3 = {
    schemaVersion: 3,
    id: 'p',
    name: 'Maison',
    createdAt: 1,
    updatedAt: 2,
    plan: { rooms: [room], passages: [] },
    zones: [],
    poses: [],
    modules: {},
  };

  it('le plan devient l’état existant, rien d’autre ne bouge', () => {
    const { doc, changed } = migrateProject(v3);
    expect(changed).toBe(true);
    expect(doc.schemaVersion).toBe(4);
    expect('plan' in doc).toBe(false);
    expect(doc.site).toEqual({ existing: v3.plan, partitions: [], demolitions: [] });
    expect(doc.zones).toBe(v3.zones);
    expect(doc.modules).toEqual({});
  });

  it('le projet chargé a le même plan qu’avant (même référence que l’état existant)', () => {
    const p = hydrate(migrateProject(v3).doc);
    expect(p.plan).toBe(p.site.existing);
    expect(p.plan).toEqual(v3.plan);
  });

  it('un document déjà en schéma 4 ne change pas', () => {
    const stored = dehydrate(project());
    const r = migrateProject(stored);
    expect(r.changed).toBe(false);
    expect(r.doc).toEqual(stored);
  });

  it('le plan calculé n’est pas enregistré', () => {
    expect('plan' in dehydrate(project())).toBe(false);
  });
});

describe('projet : travaux', () => {
  const add: ProjectAction = { type: 'plan/partition/add', partition: cloison };

  it('le plan après travaux suit chaque action', () => {
    const p = reduceProject(project(), add);
    expect(p.plan.rooms).toHaveLength(2);
    expect(p.plan).toBe(planAfter(p.site));
    const q = reduceProject(p, { type: 'plan/partition/remove', partitionId: 'c1' });
    expect(q.plan).toBe(q.site.existing);
    expect(q.plan.rooms).toHaveLength(1);
  });

  it('les actions plan/* agissent sur l’état existant', () => {
    const p = reduceProject(reduceProject(project(), add), {
      type: 'plan/room/update',
      roomId: 'a',
      patch: { name: 'Salon' },
    });
    expect(p.site.existing.rooms[0]!.name).toBe('Salon');
    expect(p.plan.rooms.find((r) => r.id === 'a')!.name).toBe('Salon');
  });

  it('un tracé = une étape d’annulation, et annuler rend exactement l’état d’avant', () => {
    const before = project();
    const store = createProjectStore(before, (d: Project, a: ProjectAction) => reduceProject(d, a));
    store.dispatch(add);
    expect(store.get().project.plan.rooms).toHaveLength(2);
    store.undo();
    expect(store.get().project).toBe(before);
    expect(store.get().canUndo).toBe(false);
  });

  it('les revêtements ne sont pas supprimés : rognés par la cloison, rétablis quand elle part', () => {
    const p0 = project();
    const z = p0.zones[0]!;
    const full = zoneArea(p0.plan, z);
    const p1 = reduceProject(p0, add);
    expect(p1.zones).toBe(p0.zones);
    expect(zoneArea(p1.plan, z)).toBeLessThan(full);
    expect(zoneArea(p1.plan, z)).toBeGreaterThan(0);
    const p2 = reduceProject(p1, { type: 'plan/partition/remove', partitionId: 'c1' });
    expect(zoneArea(p2.plan, z)).toBe(full);
  });

  it('une pièce supprimée emporte ses démolitions', () => {
    const b = { ...rect('b', 3000, 3000), origin: [4072, 0] as [number, number] };
    let p = project();
    p = reduceProject(p, { type: 'plan/room/add', room: b });
    p = reduceProject(p, {
      type: 'plan/demolition/add',
      demolition: { id: 'd', room: 'b', wall: 'b-w3', from: 0, to: 3000 },
    });
    expect(p.site.demolitions).toHaveLength(1);
    p = reduceProject(p, { type: 'plan/room/remove', roomId: 'b' });
    expect(p.site.demolitions).toHaveLength(0);
  });
});
