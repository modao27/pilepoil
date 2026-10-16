import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/modules/carrelage/core';
import { createPoseSettings, createTile } from '../../src/modules/carrelage/state/factories';
import { rectPoly } from '../../src/core/geometry/polygon';
import { ids, lShape, rect, tiledProject, tilePose, view, wallOnly } from './planFixtures';
import { carrelageData } from '../../src/modules/carrelage/state/data';
import { newPoseSettings, wallHeightCuts } from '../../src/modules/carrelage/state/poses';
import { projectArea, projectCost } from '../../src/modules/carrelage/state/pricing';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import type { Component } from 'svelte';
import { moduleById } from '../../src/modules/registry';
import type { ModuleScreenProps } from '../../src/modules/types';
import { matchScreen, type ScreenMatch } from '../../src/ui/lib/moduleRoutes';
import { href, parseRoute, type Route } from '../../src/ui/lib/routes';

const tile = createTile({ pricePerM2: 30 });
const layout = { tileId: tile.id, tileUpright: false, pattern: 'half' as const, angle: 0, joint: 3 };

describe('poses de carrelage', () => {
  it('nouvelle pose : reprend les réglages d’une autre (bandes copiées), sinon le premier carreau', () => {
    const p = wallOnly(layout, 3000, 2400);
    const copy = newPoseSettings(carrelageData(p), [tile], ids('c'), 't1');
    expect(copy.bands).toMatchObject([{ id: 'c0', tileId: tile.id, pattern: 'half' }]);
    expect(newPoseSettings(null, [tile], ids('d')).bands[0]!.tileId).toBe(tile.id);
  });

  it('hauteur carrelée d’un mur : une ligne sous laquelle on carrèle, aucune jusqu’au plafond', () => {
    const plan = { rooms: [rect('r', 3000, 2000, { height: 2500 })], passages: [] };
    const wall = { room: 'r', wall: 'r-w0' };
    expect(wallHeightCuts(plan, wall, 1200)).toEqual([
      {
        line: [
          [0, 1200],
          [3000, 1200],
        ],
        side: -1,
      },
    ]);
    expect(wallHeightCuts(plan, wall, null)).toEqual([]);
    expect(wallHeightCuts(plan, wall, 3000)).toEqual([]);
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
    const p = view(tiledProject([withPost], [tilePose('F', { room: 'r', wall: null }, createPoseSettings(tile.id))]));
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
    ['#/import', { name: 'import', text: '' }],
    [
      '#/import/Carreau%2060%20x%2060%2Fgris%0AEpaisseur%099',
      { name: 'import', text: 'Carreau 60 x 60/gris\nEpaisseur\t9' },
    ],
    ['#/p/x1', { name: 'project', id: 'x1' }],
    ['#/p/x1/plan', { name: 'plan', id: 'x1' }],
    ['#/p/x1/achats', { name: 'shopping', id: 'x1' }],
    ['#/p/x1/m/carrelage', { name: 'module', id: 'x1', module: 'carrelage', path: '' }],
    ['#/p/x1/m/carrelage/s/s2', { name: 'module', id: 'x1', module: 'carrelage', path: 's/s2' }],
    ['#/p/x1/resultats', { name: 'results', id: 'x1', scope: { kind: 'project' } }],
    ['#/p/x1/r/r2/resultats', { name: 'results', id: 'x1', scope: { kind: 'room', room: 'r2' } }],
    ['#/p/x1/pose/p3/resultats', { name: 'results', id: 'x1', scope: { kind: 'pose', pose: 'p3' } }],
    ['#/p/x1/r/r2/sol', { name: 'room', id: 'x1', room: 'r2', surface: 'sol' }],
    ['#/p/x%2F1/m/carrelage/s/a%20b', { name: 'module', id: 'x/1', module: 'carrelage', path: 's/a b' }],
    ['#/p/x1/z', { name: 'notFound', path: '/p/x1/z' }],
  ])('%s', (h, r) => {
    expect(parseRoute(h)).toEqual(r);
    if (r.name !== 'notFound' && h.length > 2) expect(parseRoute(href(r))).toEqual(r);
  });

  it('anciens résultats d’un outil : ceux du projet', () => {
    const r = parseRoute('#/p/x1/m/parquet/results');
    expect(r).toEqual({ name: 'redirect', to: { name: 'results', id: 'x1', scope: { kind: 'project' } } });
    expect(href(r)).toBe('#/p/x1/resultats');
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
  const room = async () => Fake;
  const screens = {
    editor,
    routes: [
      { path: 's/:surfaceId', load: editor },
      { path: 'room', load: room },
    ],
  };

  it.each<[string, ScreenMatch | null]>([
    ['', { load: editor, params: {} }],
    ['chantier', null],
    ['results', null],
    ['s/s2', { load: editor, params: { surfaceId: 's2' } }],
    ['room', { load: room, params: {} }],
    ['s', null],
    ['s/s2/x', null],
  ])('%s', (path, m) => {
    expect(matchScreen(screens, path)).toEqual(m);
  });

  it('carrelage : éditeur, surface, comparaison (résultats sur l’écran commun)', () => {
    const s = moduleById('carrelage')!.screens;
    for (const path of ['', 's/a', 'compare']) expect(matchScreen(s, path)).not.toBeNull();
    for (const path of ['results', 'room/r1']) expect(matchScreen(s, path)).toBeNull();
    expect(matchScreen(s, '')!.load).toBe(s.editor);
    expect(matchScreen(s, 's/a')!.load).not.toBe(s.editor);
    expect(matchScreen(s, 's/pose-1')!.params).toEqual({ surfaceId: 'pose-1' });
  });
});
