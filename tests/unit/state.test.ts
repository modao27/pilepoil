import { describe, expect, it } from 'vitest';
import { reduce, tilingAction } from '../../src/modules/carrelage/state/actions';
import {
  createData,
  createFloorTiling,
  createReservation,
  createRoomTiling,
  createTile,
  createWallTiling,
  createZone,
} from '../../src/modules/carrelage/state/factories';
import type { CarrelageData } from '../../src/modules/carrelage/state/data';
import { surfaceId } from '../../src/modules/carrelage/state/surfaces';
import { HISTORY_LIMIT, initHistory, record, redo, undo } from '../../src/state/history';
import { tileSpec } from '../../src/modules/carrelage/state/selectors';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';
import { createProjectStore, type ProjectState } from '../../src/state/store';
import { planProject, rect } from './planFixtures';

const tile = createTile();
const room = rect('r', 3000, 2000);
const plan = { rooms: [room], passages: [] };
const FLOOR = surfaceId({ room: 'r', wall: null });
const W0 = surfaceId({ room: 'r', wall: 'r-w0' });
/** Sol et mur 1 de la pièce r carrelés. */
const make = (): CarrelageData =>
  createData({
    rooms: { r: createRoomTiling({ floor: createFloorTiling(tile.id), walls: { 'r-w0': createWallTiling(tile.id) } }) },
  });

describe('réducteur', () => {
  it('ne modifie jamais son entrée et garde la référence si rien ne change', () => {
    const p = make();
    const frozen = JSON.stringify(p);
    const z = p.rooms.r!.floor!.zones[0]!;
    const q = reduce(p, { type: 'carrelage/zone/update', surfaceId: FLOOR, zoneId: z.id, patch: { angle: 45 } });
    expect(JSON.stringify(p)).toBe(frozen);
    expect(q.rooms.r!.floor!.zones[0]!.angle).toBe(45);
    expect(q.rooms.r!.walls).toBe(p.rooms.r!.walls);
    expect(reduce(p, { type: 'carrelage/zone/update', surfaceId: FLOOR, zoneId: z.id, patch: { angle: 0 } })).toBe(p);
    expect(reduce(p, { type: 'carrelage/surface/update', surfaceId: 'r~inconnu', patch: { joint: 1 } })).toBe(p);
    expect(reduce(p, { type: 'carrelage/surface/update', surfaceId: 'mal formé', patch: { joint: 1 } })).toBe(p);
  });

  it('réglages propres au sol ou au mur : ceux de l’autre type sont ignorés', () => {
    const p = make();
    const q = reduce(p, {
      type: 'carrelage/surface/update',
      surfaceId: W0,
      patch: { tiledHeight: 1200, plinth: null },
    });
    expect(q.rooms.r!.walls['r-w0']).toMatchObject({ tiledHeight: 1200 });
    expect(q.rooms.r!.walls['r-w0']).not.toHaveProperty('plinth');
    expect(reduce(p, { type: 'carrelage/surface/update', surfaceId: FLOOR, patch: { tiledHeight: 1200 } })).toBe(p);
  });

  it('zones : ajout, déplacement, suppression (jamais la dernière, plinthe reportée)', () => {
    let p = make();
    const z0 = p.rooms.r!.floor!.zones[0]!,
      z1 = createZone(tile.id);
    p = reduce(p, { type: 'carrelage/zone/add', surfaceId: FLOOR, zone: z1 });
    p = reduce(p, {
      type: 'carrelage/surface/update',
      surfaceId: FLOOR,
      patch: { plinth: { length: 1000, height: 80, zoneId: z0.id } },
    });
    p = reduce(p, { type: 'carrelage/zone/move', surfaceId: FLOOR, zoneId: z1.id, to: 0 });
    expect(p.rooms.r!.floor!.zones.map((z) => z.id)).toEqual([z1.id, z0.id]);
    p = reduce(p, { type: 'carrelage/zone/remove', surfaceId: FLOOR, zoneId: z0.id });
    expect(p.rooms.r!.floor!.plinth!.zoneId).toBe(z1.id);
    expect(reduce(p, { type: 'carrelage/zone/remove', surfaceId: FLOOR, zoneId: z1.id })).toBe(p);
  });

  it('modèle de zones : toutes remplacées, plinthe reportée', () => {
    const p = reduce(make(), {
      type: 'carrelage/surface/update',
      surfaceId: FLOOR,
      patch: { plinth: { length: 1000, height: 80, zoneId: 'x' } },
    });
    const zones = [createZone(tile.id, { unit: 'rows', size: 3 }), createZone(tile.id, { pattern: 'herring' })];
    const q = reduce(p, { type: 'carrelage/zone/replaceAll', surfaceId: FLOOR, zones, split: 'v' });
    expect(q.rooms.r!.floor).toMatchObject({ split: 'v', plinth: { zoneId: zones[0]!.id } });
  });

  it('réservations et finitions des ouvertures du plan', () => {
    let p = make();
    const r = createReservation('socket', { x: 500 });
    p = reduce(p, { type: 'carrelage/reservation/add', surfaceId: W0, reservation: r });
    p = reduce(p, { type: 'carrelage/reservation/update', surfaceId: W0, reservationId: r.id, patch: { x: 800 } });
    expect(p.rooms.r!.walls['r-w0']!.reservations).toMatchObject([{ id: r.id, x: 800, type: 'socket' }]);
    p = reduce(p, { type: 'carrelage/opening/finish', surfaceId: W0, openingId: 'o1', patch: { revealDepth: 150 } });
    expect(p.rooms.r!.walls['r-w0']!.openings.o1).toEqual({
      covered: true,
      revealDepth: 150,
      reveals: { left: true, right: true, top: true, bottom: false },
    });
    // pas de finition sur un sol
    expect(reduce(p, { type: 'carrelage/opening/finish', surfaceId: FLOOR, openingId: 'o1', patch: {} })).toBe(p);
    p = reduce(p, { type: 'carrelage/reservation/remove', surfaceId: W0, reservationId: r.id });
    expect(p.rooms.r!.walls['r-w0']!.reservations).toEqual([]);
  });

  it('carreler ou non un sol, un mur ; une pièce sans rien de carrelé disparaît', () => {
    let p = make();
    p = reduce(p, { type: 'carrelage/wall/enable', roomId: 'r', wallId: 'r-w1', tiling: createWallTiling(tile.id) });
    expect(Object.keys(p.rooms.r!.walls)).toEqual(['r-w0', 'r-w1']);
    const again = createWallTiling('');
    expect(reduce(p, { type: 'carrelage/wall/enable', roomId: 'r', wallId: 'r-w1', tiling: again })).toBe(p);
    p = reduce(p, { type: 'carrelage/floor/disable', roomId: 'r' });
    p = reduce(p, { type: 'carrelage/wall/disable', roomId: 'r', wallId: 'r-w0' });
    expect(p.rooms.r).toMatchObject({ floor: null, walls: { 'r-w1': {} } });
    p = reduce(p, { type: 'carrelage/wall/disable', roomId: 'r', wallId: 'r-w1' });
    expect(p.rooms).toEqual({});
    p = reduce(p, { type: 'carrelage/floor/enable', roomId: 'b', tiling: createFloorTiling(tile.id) });
    expect(p.rooms.b!.floor).not.toBeNull();
    const q = reduce(p, { type: 'carrelage/room', roomId: 'b', patch: { outerCornersCovered: false } });
    expect(q.rooms.b).toMatchObject({ outerCornersCovered: false });
  });

  it('pièce supprimée du plan, nettoyage des murs disparus', () => {
    let p = make();
    p = reduce(p, { type: 'carrelage/wall/enable', roomId: 'r', wallId: 'disparu', tiling: createWallTiling(tile.id) });
    p = reduce(p, { type: 'carrelage/floor/enable', roomId: 'absente', tiling: createFloorTiling(tile.id) });
    const pruned = reduce(p, { type: 'carrelage/prune' }, plan);
    expect(Object.keys(pruned.rooms)).toEqual(['r']);
    expect(Object.keys(pruned.rooms.r!.walls)).toEqual(['r-w0']);
    expect(reduce(pruned, { type: 'carrelage/prune' }, plan)).toBe(pruned);
    expect(reduce(pruned, { type: 'plan/room/removed', roomId: 'r' }).rooms).toEqual({});
  });

  it('prix : saisie et effacement', () => {
    let p = reduce(make(), { type: 'carrelage/price', key: 'colle', value: 18.5 });
    expect(p.prices).toEqual({ colle: 18.5 });
    p = reduce(p, { type: 'carrelage/price', key: 'colle', value: null });
    expect(p.prices).toEqual({});
  });

  it('carreler une surface : reprend le carrelage d’une autre, zones copiées ; un sol a une seule zone', () => {
    let n = 0;
    const id = () => `z${n++}`;
    const like = { joint: 2, split: 'v' as const, zones: [createZone(tile.id, { unit: 'rows' }), createZone(tile.id)] };
    const wall = tilingAction({ room: 'r', wall: 'r-w1' }, true, like, '', id);
    expect(wall).toMatchObject({ type: 'carrelage/wall/enable', wallId: 'r-w1', tiling: { joint: 2, split: 'v' } });
    if (wall.type !== 'carrelage/wall/enable') throw new Error();
    expect(wall.tiling.zones.map((z) => z.id)).toEqual(['z0', 'z1']);
    const floor = tilingAction({ room: 'r', wall: null }, true, like, '', id);
    if (floor.type !== 'carrelage/floor/enable') throw new Error();
    expect(floor.tiling.zones).toMatchObject([{ unit: 'rest', tileId: tile.id }]);
    expect(tilingAction({ room: 'r', wall: null }, true, undefined, 't9', id)).toMatchObject({
      tiling: { zones: [{ tileId: 't9' }] },
    });
    expect(tilingAction({ room: 'r', wall: 'r-w1' }, false, like, '', id)).toEqual({
      type: 'carrelage/wall/disable',
      roomId: 'r',
      wallId: 'r-w1',
    });
  });

  it('remplacement : toutes les données carrelage', () => {
    expect(reduce(make(), { type: 'carrelage/replace', data: createData() })).toEqual(createData());
  });
});

describe('historique', () => {
  it('annuler, rétablir, futur vidé par une nouvelle action', () => {
    let h = initHistory(1);
    h = record(h, 2, null, 0);
    h = record(h, 3, null, 10);
    h = undo(h);
    expect(h.present).toBe(2);
    h = redo(h);
    expect(h.present).toBe(3);
    h = undo(record(undo(h), 9, null, 20));
    expect(h.present).toBe(2);
    expect(h.future).toEqual([9]);
  });

  it('un même geste rapide fusionne en une étape', () => {
    let h = initHistory(0);
    for (let i = 1; i <= 5; i++) h = record(h, i, 'drag', i * 100);
    expect(h.past).toEqual([0]);
    h = record(h, 6, 'drag', 100 + 500 + 900);
    expect(h.past).toEqual([0, 5]);
    h = record(h, 7, 'other', 1501);
    expect(h.past).toEqual([0, 5, 6]);
  });

  it('limité à HISTORY_LIMIT étapes', () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = record(h, i, null, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe('store', () => {
  it('notifie, date les modifications, annule et enregistre', () => {
    let t = 5000;
    const saved: number[] = [];
    const doc = planProject([room], make(), { name: 'Nouveau projet', updatedAt: 1000 });
    const store = createProjectStore(doc, reduceProject, {
      now: () => t,
      onChange: (p) => saved.push(p.updatedAt),
    });
    const states: ProjectState<Project>[] = [];
    const off = store.subscribe((s) => states.push(s));
    store.dispatch({ type: 'project/rename', name: 'Salle de bain' });
    expect(store.get()).toMatchObject({ canUndo: true, canRedo: false });
    expect(store.get().project.updatedAt).toBe(5000);
    t = 6000;
    store.undo();
    expect(store.get().project.name).toBe('Nouveau projet');
    store.dispatch({ type: 'project/rename', name: 'Nouveau projet' });
    expect(states).toHaveLength(3);
    expect(saved).toEqual([5000, 1000]);
    off();
    store.redo();
    expect(states).toHaveLength(3);
  });
});

describe('passage au moteur', () => {
  it('carreau debout ou couché, hexagone', () => {
    expect(tileSpec(tile, false)).toMatchObject({ width: 600, height: 300 });
    expect(tileSpec(tile, true)).toMatchObject({ width: 300, height: 600 });
    expect(tileSpec(createTile({ shape: 'hex', length: 200, width: 200 }), true)).toMatchObject({
      width: 200,
      height: 200,
    });
  });
});
