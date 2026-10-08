import { describe, expect, it } from 'vitest';
import { evaluateZone, scoreOf } from '../../src/core/optimizer/evaluate';
import { optimizeZones, optimizeZonesSync } from '../../src/core/optimizer/optimize';
import type { Settings } from '../../src/core/types';
import { surface, zone } from './fixtures';

const settings: Settings = { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20 };

describe('score', () => {
  const r = { needed: 10, thin: 2, vis: 1, minD: 30 };
  it('pondère selon l’objectif', () => {
    expect(scoreOf(r, 'thin')).toBeCloseTo(200 + 70 + 10 + 5, 9);
    expect(scoreOf(r, 'tiles')).toBeCloseTo(1000 + 16 + 8 + 0.5, 9);
    expect(scoreOf(r, 'bal')).toBe(scoreOf(r, 'sym'));
  });
  it('sans coupe, pas de pénalité de petite coupe', () => {
    expect(scoreOf({ needed: 4, thin: 0, vis: 0, minD: Infinity }, 'thin')).toBe(4);
  });
});

describe('optimisation', () => {
  it('ne dégrade jamais le score', () => {
    const s = surface({ width: 2400, height: 1800, zones: [zone({ pattern: 'grid', offsetX: 290, offsetY: 140 })] });
    const before = scoreOf(evaluateZone(s, 0, {}, settings), 'thin');
    const res = optimizeZonesSync(s, [0], 'thin', settings);
    const o = res.zones[0]!;
    const after = scoreOf(evaluateZone(s, 0, o, settings), 'thin');
    expect(after).toBeLessThanOrEqual(before);
    expect(res.after.thin).toBeLessThanOrEqual(res.before.thin);
  });

  it('rend une progression croissante jusqu’à 100 %', () => {
    const it = optimizeZones(surface({ width: 1800, height: 1200 }), [0], 'tiles', settings);
    const seen: number[] = [];
    let r = it.next();
    while (!r.done) {
      seen.push(r.value.percent);
      r = it.next();
    }
    expect(seen.length).toBeGreaterThan(5);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(94);
    expect(r.value.zones).toHaveLength(1);
  });

  it('peut être abandonnée en cours de route sans effet', () => {
    const s = surface();
    const it = optimizeZones(s, [0], 'thin', settings);
    it.next();
    it.return(undefined as never);
    expect(s.zones[0]!.offsetX).toBe(0);
  });

  it('symétrique : départ centré, ou centrage le long d’une zone en rangées', () => {
    const free = optimizeZonesSync(surface(), [0], 'sym', settings);
    expect(['tile', 'joint']).toContain(free.zones[0]!.start);
    const rows = optimizeZonesSync(
      surface({ zones: [zone({ pattern: 'grid', unit: 'rows', size: 2 }), zone()] }),
      [0],
      'sym',
      settings,
    );
    expect(rows.zones[0]).toMatchObject({ start: 'corner', offsetY: 0 });
  });

  it('surface invalide : rien n’est changé', () => {
    expect(optimizeZonesSync(surface({ width: 0 }), [0], 'thin', settings).zones).toEqual([]);
  });
});
