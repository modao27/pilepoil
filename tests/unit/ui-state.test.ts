import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/modules/carrelage/core';
import { createFloorTiling, createRoomTiling, createTile } from '../../src/modules/carrelage/state/factories';
import { rectPoly } from '../../src/core/geometry/polygon';
import { floorOnly, lShape, planProject, view, wallOnly } from './planFixtures';
import { surfaceId } from '../../src/modules/carrelage/state/surfaces';
import { projectArea, projectCost } from '../../src/modules/carrelage/state/pricing';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { createWizardProject, formRoom, validForm } from '../../src/modules/carrelage/state/templates';
import type { Component } from 'svelte';
import { moduleById } from '../../src/modules/registry';
import type { ModuleScreenProps } from '../../src/modules/types';
import { matchScreen, type ScreenMatch } from '../../src/ui/lib/moduleRoutes';
import { href, parseRoute, type Route } from '../../src/ui/lib/routes';

const tile = createTile({ pricePerM2: 30 });
const layout = { tileId: tile.id, tileUpright: false, pattern: 'half' as const, angle: 0, joint: 3 };

describe('modèles de l’assistant', () => {
  it('mur seul : premier mur d’une pièce du plan, hauteur sous plafond = hauteur du mur', () => {
    const p = view(wallOnly(layout, 3000, 2400));
    expect(p.plan.rooms).toHaveLength(1);
    expect(p.surfaces).toHaveLength(1);
    expect(p.surfaces[0]).toMatchObject({ kind: 'wall', width: 3000, height: 2400, joint: 3 });
    expect(p.surfaces[0]!.zones[0]).toMatchObject({ tileId: tile.id, pattern: 'half' });
  });

  it('sol seul : contour de la pièce', () => {
    const p = view(floorOnly(layout, 2000, 1500));
    expect(p.surfaces).toHaveLength(1);
    expect(p.surfaces[0]).toMatchObject({ kind: 'floor', width: 2000, height: 1500 });
  });

  it('pièce en L : sol puis murs cochés, hauteur carrelée bornée par la hauteur, nom par défaut', () => {
    const form = { kind: 'l' as const, length: 4000, width: 3000, cutLength: 1500, cutWidth: 1000 };
    const p = view(
      createWizardProject({ ...layout, form, height: 2500, tiledHeight: 2600, floor: true, walls: [0, 3, 9] }),
    );
    expect(p.name).toBe('Pièce 400 × 300');
    expect(p.plan.rooms[0]!.outline).toHaveLength(6);
    expect(p.surfaces.map((s) => [s.name, s.kind, s.width, s.height])).toEqual([
      ['Pièce, sol', 'floor', 4000, 3000],
      ['Pièce, mur 1', 'wall', 4000, 2500],
      ['Pièce, mur 4', 'wall', 1000, 2500],
    ]);
    // zones propres à chaque surface
    expect(new Set(p.surfaces.map((s) => s.zones[0]!.id)).size).toBe(3);
    expect(computeProject(toProjectSpec(p, [tile]).spec).surfaces.every((s) => s.ok)).toBe(true);
  });

  it('formes : murs par forme, cotes incohérentes refusées', () => {
    expect(
      formRoom({ kind: 'u', length: 4000, width: 3000, arm: 1000, depth: 1200 }, { name: 'U', height: 2500 }).walls,
    ).toHaveLength(8);
    expect(validForm({ kind: 'l', length: 4000, width: 3000, cutLength: 4000, cutWidth: 500 })).toBe(false);
    expect(validForm({ kind: 'u', length: 4000, width: 3000, arm: 2000, depth: 500 })).toBe(false);
    expect(validForm({ kind: 'rect', length: 0, width: 3000 })).toBe(false);
  });
});

describe('prix', () => {
  it('prix du projet prioritaire, sinon prix au m² du carreau', () => {
    const p = view(wallOnly(layout, 1200, 600));
    const R = computeProject(toProjectSpec(p, [tile]).spec);
    const tileItem = R.shopping.find((s) => s.kind === 'tile')!;
    const base = projectCost(p, [tile], R);
    expect(base.total).toBeCloseTo(30 * tileItem.mult, 9);
    expect(base.unpriced).toBe(R.shopping.length - 1);
    const priced = projectCost({ ...p, prices: { [tileItem.key]: 10, colle: 20 } }, [tile], R);
    const glue = R.shopping.find((s) => s.key === 'colle')!;
    expect(priced.total).toBeCloseTo(10 * tileItem.mult + 20 * glue.mult, 9);
    expect(projectArea(p)).toBeCloseTo(0.72, 12);
  });

  it('surface d’un sol : contour, obstacles déduits', () => {
    const room = lShape('r', 4000, 3000, 1500, 1000);
    const withPost = {
      ...room,
      obstacles: [{ id: 'o', kind: 'post' as const, outline: rectPoly(1000, 1000, 200, 200) }],
    };
    const p = view(planProject([withPost], { rooms: { r: createRoomTiling({ floor: createFloorTiling(tile.id) }) } }));
    expect(projectArea(p)).toBeCloseTo(12 - 1.5 - 0.04, 9);
  });
});

describe('routes', () => {
  it.each<[string, Route]>([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/new', { name: 'new' }],
    ['#/new/carrelage', { name: 'new', module: 'carrelage' }],
    ['#/new/inconnu', { name: 'notFound', path: '/new/inconnu' }],
    ['#/library/tiles', { name: 'library', lib: 'tiles' }],
    ['#/library/boards/new', { name: 'libraryItem', lib: 'boards', id: null }],
    ['#/library/tiles/abc', { name: 'libraryItem', lib: 'tiles', id: 'abc' }],
    ['#/library/abc/def', { name: 'notFound', path: '/library/abc/def' }],
    ['#/settings', { name: 'settings' }],
    ['#/p/x1', { name: 'project', id: 'x1' }],
    ['#/p/x1/plan', { name: 'plan', id: 'x1' }],
    ['#/p/x1/achats', { name: 'shopping', id: 'x1' }],
    ['#/p/x1/m/carrelage', { name: 'module', id: 'x1', module: 'carrelage', path: '' }],
    ['#/p/x1/m/carrelage/s/s2', { name: 'module', id: 'x1', module: 'carrelage', path: 's/s2' }],
    ['#/p/x1/m/carrelage/results', { name: 'module', id: 'x1', module: 'carrelage', path: 'results' }],
    ['#/p/x%2F1/m/carrelage/s/a%20b', { name: 'module', id: 'x/1', module: 'carrelage', path: 's/a b' }],
    ['#/p/x1/z', { name: 'notFound', path: '/p/x1/z' }],
  ])('%s', (h, r) => {
    expect(parseRoute(h)).toEqual(r);
    if (r.name !== 'notFound' && h.length > 2) expect(parseRoute(href(r))).toEqual(r);
  });

  it('#/library : la première bibliothèque ; plus d’anciennes adresses', () => {
    const r = parseRoute('#/library');
    expect(r.name).toBe('redirect');
    expect(href(r)).toBe('#/library/tiles');
    for (const old of ['#/p/x1/results', '#/p/x1/s/s2', '#/p/x1/compare', '#/library/abc'])
      expect(parseRoute(old).name).toBe('notFound');
  });
});

describe('écrans des modules', () => {
  const Fake = (() => {}) as unknown as Component<ModuleScreenProps>;
  const editor = async () => Fake;
  const results = async () => Fake;
  const room = async () => Fake;
  const screens = {
    editor,
    results,
    routes: [
      { path: 's/:surfaceId', load: editor },
      { path: 'room', load: room },
    ],
  };

  it.each<[string, ScreenMatch | null]>([
    ['', { load: editor, params: {} }],
    ['results', { load: results, params: {} }],
    ['s/s2', { load: editor, params: { surfaceId: 's2' } }],
    ['room', { load: room, params: {} }],
    ['chantier', null],
    ['s', null],
    ['s/s2/x', null],
  ])('%s', (path, m) => {
    expect(matchScreen(screens, path)).toEqual(m);
  });

  it('carrelage : éditeur, résultats, surface, comparaison', () => {
    const s = moduleById('carrelage')!.screens;
    for (const path of ['', 'results', 's/a', 'compare']) expect(matchScreen(s, path)).not.toBeNull();
    expect(matchScreen(s, '')!.load).toBe(s.editor);
    expect(matchScreen(s, 's/a')!.load).not.toBe(s.editor);
    expect(matchScreen(s, `s/${surfaceId({ room: 'r1', wall: 'w2' })}`)!.params).toEqual({ surfaceId: 'r1~w2' });
  });
});
