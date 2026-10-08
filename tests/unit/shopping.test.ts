/**
 * Liste d'achat consolidée (docs/BOITE.md §7) : pour un projet carrelage, elle reprend à l'identique la
 * liste de l'écran Résultats (mêmes articles, quantités, prix unitaires et coûts).
 */
import { describe, expect, it } from 'vitest';
import { module as carrelage } from '../../src/modules/carrelage';
import { computeProject, type ProjectResult } from '../../src/modules/carrelage/core';
import { dataOf, type CarrelageProject } from '../../src/modules/carrelage/state/data';
import { createOpening, createTile } from '../../src/modules/carrelage/state/factories';
import { itemPrice, projectCost } from '../../src/modules/carrelage/state/pricing';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { createRoomProject, createSingleSurfaceProject } from '../../src/modules/carrelage/state/templates';
import { shoppingLabel } from '../../src/modules/carrelage/ui/lib/labels';
import type { Tile } from '../../src/modules/carrelage/state/model';
import { consolidate, parsePrice, toCsv } from '../../src/ui/lib/shopping';

const priced = createTile({ name: 'Grès 60 × 30', pricePerM2: 32.5 });
const unpriced = createTile({ name: 'Faïence 20 × 20', length: 200, width: 200, m2PerBox: 1, pricePerM2: null });
const byPiece = createTile({ name: 'Zellige', length: 100, width: 100, m2PerBox: 0, pricePerM2: 40 });
const tiles: Tile[] = [priced, unpriced, byPiece];

const layout = (t: Tile) => ({
  tileId: t.id,
  tileUpright: false,
  pattern: 'half' as const,
  angle: 0 as const,
  joint: 3,
});

/** Projets variés : mur seul, pièce complète, prix saisis dans le projet, carreau sans prix, vente à la pièce. */
function projects(): CarrelageProject[] {
  const wall = createSingleSurfaceProject({ ...layout(priced), kind: 'wall', width: 3000, height: 2400 }, 0);
  const room = createRoomProject(
    {
      ...layout(unpriced),
      length: 2400,
      width: 1800,
      height: 2500,
      tiledHeight: 2000,
      walls: { A: true, B: true, C: true, D: false, floor: true },
    },
    0,
  );
  room.surfaces[0]!.openings.push(createOpening('door'));
  room.prices = { colle: 18.9, 'tile|x': 1, crois: 3.2 };
  const pieces = createSingleSurfaceProject({ ...layout(byPiece), kind: 'floor', width: 1200, height: 900 }, 0);
  pieces.prices = { ['tile|' + 'inconnu']: 5 };
  return [wall, room, pieces];
}

const compute = (p: CarrelageProject): ProjectResult => computeProject(toProjectSpec(p, tiles).spec);

describe('liste d’achat consolidée du carrelage', () => {
  for (const p of projects())
    it(`identique à l’écran Résultats : ${p.name}`, () => {
      const r = compute(p);
      const byId = new Map(tiles.map((t) => [t.id, t]));
      const lines = carrelage.shopping(r, dataOf(p), { tiles });
      expect(r.shopping.length).toBeGreaterThan(2);
      // mêmes articles, dans le même ordre
      expect(lines.map((l) => l.key)).toEqual(r.shopping.map((it) => it.key));
      r.shopping.forEach((it, i) => {
        const l = lines[i]!;
        const text = shoppingLabel(it, r.plan.groups);
        const price = itemPrice(it, p, byId, r);
        expect(l).toMatchObject({ module: 'carrelage', label: text.label, detail: text.qty, quantity: it.mult });
        expect(l.unitPrice).toBe(price ?? null);
        // coût de la ligne : même calcul (prix × quantité de prix)
        expect(l.unitPrice == null ? null : l.unitPrice * l.quantity).toBe(price != null ? price * it.mult : null);
      });
      // total et articles sans prix : identiques à l'écran Résultats
      const c = consolidate(lines);
      const cost = projectCost(p, tiles, r);
      expect(c.total).toBeCloseTo(cost.total, 9);
      expect(c.unpriced).toBe(cost.unpriced);
      expect(c.byModule).toEqual([{ module: 'carrelage', total: c.total, unpriced: cost.unpriced }]);
    });

  it('prix saisi dans le projet : il l’emporte sur la bibliothèque, et se modifie par l’action du module', () => {
    const p = projects()[0]!;
    const r = compute(p);
    const key = r.shopping.find((it) => it.kind === 'tile')!.key;
    const before = carrelage.shopping(r, dataOf(p), { tiles }).find((l) => l.key === key)!;
    expect(before).toMatchObject({ unitPrice: 32.5, priceFromLibrary: true });
    const data = carrelage.reduce(dataOf(p), carrelage.priceAction(key, 29.9), { rooms: [], passages: [] });
    const after = carrelage.shopping(r, data, { tiles }).find((l) => l.key === key)!;
    expect(after).toMatchObject({ unitPrice: 29.9, priceFromLibrary: false });
    const cleared = carrelage.reduce(data, carrelage.priceAction(key, null), { rooms: [], passages: [] });
    expect(carrelage.shopping(r, cleared, { tiles }).find((l) => l.key === key)!.unitPrice).toBe(32.5);
  });

  it('rayons : revêtements, consommables, outils, finitions', () => {
    const p = projects()[1]!;
    const lines = carrelage.shopping(compute(p), dataOf(p), { tiles });
    const group = (k: string) => lines.find((l) => l.key === k || l.key.startsWith(k))?.group;
    expect(group('tile|')).toBe('covering');
    expect(group('colle')).toBe('consumable');
    expect(group('joint|')).toBe('consumable');
    expect(group('crois')).toBe('tool');
    expect(lines.map((l) => l.group).every((g) => ['covering', 'consumable', 'tool', 'finish'].includes(g))).toBe(true);
  });
});

describe('regroupement par rayon', () => {
  it('rayons dans l’ordre du magasin, totaux par module et général', () => {
    const lines = [
      { module: 'a', key: 'x', group: 'tool', label: 'X', quantity: 2, unit: 'piece', unitPrice: 5 },
      { module: 'b', key: 'y', group: 'covering', label: 'Y', quantity: 3, unit: 'm2', unitPrice: 10 },
      { module: 'a', key: 'z', group: 'covering', label: 'Z', quantity: 1, unit: 'm2', unitPrice: null },
    ] as const;
    const c = consolidate([...lines]);
    expect(c.groups.map((g) => [g.group, g.lines.map((l) => l.key), g.total])).toEqual([
      ['covering', ['y', 'z'], 30],
      ['tool', ['x'], 10],
    ]);
    expect(c.byModule).toEqual([
      { module: 'a', total: 10, unpriced: 1 },
      { module: 'b', total: 30, unpriced: 0 },
    ]);
    expect([c.total, c.unpriced]).toEqual([40, 1]);
  });
});

describe('exports et saisie', () => {
  it('prix saisi : virgule, euros, vide ou invalide = effacer', () => {
    expect(['12,5', '12.50 €', ' 7 ', '', 'abc', '-3', '0'].map(parsePrice)).toEqual([
      12.5,
      12.5,
      7,
      null,
      null,
      null,
      null,
    ]);
  });

  it('CSV pour tableur français : ; et virgule décimale, BOM, total', () => {
    const c = consolidate([
      {
        module: 'carrelage',
        key: 'tile|a',
        group: 'covering',
        label: 'Grès; 60 × 30',
        detail: '3 cartons (4,32 m²)',
        quantity: 4.32,
        unit: 'm2',
        unitPrice: 32.5,
      },
      {
        module: 'carrelage',
        key: 'colle',
        group: 'consumable',
        label: 'Mortier-colle C2',
        quantity: 2,
        unit: 'bag',
        unitPrice: null,
      },
    ]);
    const csv = toCsv(c, () => 'Carrelage');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n').slice(0, 4)).toEqual([
      '﻿Rayon;Outil;Article;Détail;Quantité;Prix unitaire;Unité de prix;Total',
      'Revêtements;Carrelage;"Grès; 60 × 30";3 cartons (4,32 m²);4,32;32,5;€/m²;140,4',
      'Consommables;Carrelage;Mortier-colle C2;;2;;€/sac;',
      'Total estimé;;;1 article(s) sans prix;;;;140,4',
    ]);
  });
});
