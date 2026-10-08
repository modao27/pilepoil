import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/modules/carrelage/core';
import { createTile } from '../../src/modules/carrelage/state/factories';
import { projectArea, projectCost } from '../../src/modules/carrelage/state/pricing';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { createRoomProject, createSingleSurfaceProject } from '../../src/modules/carrelage/state/templates';
import type { Component } from 'svelte';
import { moduleById } from '../../src/modules/registry';
import type { ModuleScreenProps } from '../../src/modules/types';
import { matchScreen, type ScreenMatch } from '../../src/ui/lib/moduleRoutes';
import { href, parseRoute, type Route } from '../../src/ui/lib/routes';

const tile = createTile({ pricePerM2: 30 });
const layout = { tileId: tile.id, tileUpright: false, pattern: 'half' as const, angle: 0, joint: 3 };

describe('modèles de l’assistant', () => {
  it('mur seul', () => {
    const p = createSingleSurfaceProject({ ...layout, kind: 'wall', width: 3000, height: 2400 });
    expect(p.name).toBe('Mur 300 × 240');
    expect(p.surfaces).toHaveLength(1);
    expect(p.surfaces[0]).toMatchObject({ kind: 'wall', width: 3000, height: 2400, joint: 3 });
    expect(p.surfaces[0]!.zones[0]).toMatchObject({ tileId: tile.id, pattern: 'half' });
  });

  it('pièce : murs A–D, sol, hauteur carrelée bornée par la hauteur', () => {
    const p = createRoomProject({
      ...layout,
      name: '  Salle de bain ',
      length: 2400,
      width: 1800,
      height: 2500,
      tiledHeight: 2600,
      walls: { A: true, B: true, C: false, D: true, floor: true },
    });
    expect(p.name).toBe('Salle de bain');
    expect(p.surfaces.map((s) => [s.name, s.kind, s.width, s.height])).toEqual([
      ['Mur A', 'wall', 2400, 2500],
      ['Mur B', 'wall', 1800, 2500],
      ['Mur D', 'wall', 1800, 2500],
      ['Sol', 'floor', 2400, 1800],
    ]);
    expect(Object.keys(p.room!.walls)).toEqual(['A', 'B', 'D', 'floor']);
    expect(computeProject(toProjectSpec(p, [tile]).spec).surfaces.every((s) => s.ok)).toBe(true);
  });
});

describe('prix', () => {
  it('prix du projet prioritaire, sinon prix au m² du carreau', () => {
    const p = createSingleSurfaceProject({ ...layout, kind: 'wall', width: 1200, height: 600 });
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
});

describe('routes', () => {
  it.each<[string, Route]>([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/new', { name: 'new' }],
    ['#/library/', { name: 'library' }],
    ['#/library/new', { name: 'tile', id: null }],
    ['#/library/abc', { name: 'tile', id: 'abc' }],
    ['#/settings', { name: 'settings' }],
    ['#/p/x1/m/carrelage', { name: 'module', id: 'x1', module: 'carrelage', path: '' }],
    ['#/p/x1/m/carrelage/s/s2', { name: 'module', id: 'x1', module: 'carrelage', path: 's/s2' }],
    ['#/p/x1/m/carrelage/results', { name: 'module', id: 'x1', module: 'carrelage', path: 'results' }],
    ['#/p/x%2F1/m/carrelage/s/a%20b', { name: 'module', id: 'x/1', module: 'carrelage', path: 's/a b' }],
    ['#/p/x1/z', { name: 'notFound', path: '/p/x1/z' }],
  ])('%s', (h, r) => {
    expect(parseRoute(h)).toEqual(r);
    if (r.name !== 'notFound' && h.length > 2) expect(parseRoute(href(r))).toEqual(r);
  });

  it.each([
    ['#/p/x1', '#/p/x1/m/carrelage'],
    ['#/p/x1/s/s2', '#/p/x1/m/carrelage/s/s2'],
    ['#/p/x1/results', '#/p/x1/m/carrelage/results'],
    ['#/p/x1/room', '#/p/x1/m/carrelage/room'],
    ['#/p/x1/compare', '#/p/x1/m/carrelage/compare'],
  ])('ancienne adresse %s → %s', (old, now) => {
    const r = parseRoute(old);
    expect(r.name).toBe('redirect');
    expect(href(r)).toBe(now);
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

  it('carrelage : éditeur, résultats, surface, pièce, comparaison', () => {
    const s = moduleById('carrelage')!.screens;
    for (const path of ['', 'results', 's/a', 'room', 'compare']) expect(matchScreen(s, path)).not.toBeNull();
    expect(matchScreen(s, 's/a')!.load).toBe(s.editor);
  });
});
