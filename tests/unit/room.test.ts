import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/state/actions';
import { createOpening, createProject, createSurface, createTile, createZone } from '../../src/state/factories';
import { applyRoom } from '../../src/state/templates';

const tile = createTile();
const all = { A: true, B: true, C: true, D: true, floor: true };
const dims = { length: 3000, width: 2000, height: 2500, tiledHeight: 2200 };

describe('pièce complète (roomGo)', () => {
  it('reprend la surface seule pour le mur A et crée les autres à son image', () => {
    const s = createSurface(tile.id, {
      openings: [createOpening('window')],
      zones: [createZone(tile.id, { pattern: 'herring' }), createZone(tile.id)],
    });
    const p = applyRoom(createProject([s]), s, { ...dims, walls: all });
    expect(p.surfaces.map((x) => [x.name, x.kind, x.width, x.height])).toEqual([
      ['Mur A', 'wall', 3000, 2200],
      ['Mur B', 'wall', 2000, 2200],
      ['Mur C', 'wall', 3000, 2200],
      ['Mur D', 'wall', 2000, 2200],
      ['Sol', 'floor', 3000, 2000],
    ]);
    expect(p.surfaces[0]!.openings).toHaveLength(1);
    expect(p.surfaces[1]!.openings).toEqual([]);
    expect(p.surfaces[1]!.zones[0]!.pattern).toBe('herring');
    expect(p.surfaces[1]!.zones[0]!.id).not.toBe(s.zones[0]!.id);
    expect(p.surfaces[4]!.zones).toHaveLength(1);
    expect(p.surfaces[4]!.zones[0]!.unit).toBe('rest');
    expect(Object.keys(p.room!.walls)).toEqual(['A', 'B', 'C', 'D', 'floor']);
  });

  it('mise à jour : redimensionne sans recréer, décocher retire de la pièce', () => {
    const s = createSurface(tile.id);
    const p1 = applyRoom(createProject([s]), s, { ...dims, walls: all });
    const p2 = applyRoom(p1, s, { ...dims, length: 3600, walls: { ...all, C: false } });
    expect(p2.surfaces).toHaveLength(5);
    expect(p2.surfaces.map((x) => x.id)).toEqual(p1.surfaces.map((x) => x.id));
    expect(p2.surfaces[0]!.width).toBe(3600);
    expect(p2.room!.walls.C).toBeUndefined();
    const p3 = applyRoom(p2, s, { ...dims, walls: { A: false, B: false, C: false, D: false, floor: false } });
    expect(p3.room).toBeNull();
  });

  it('actions : modèle de zones et remplacement de projet', () => {
    const s = createSurface(tile.id, { plinth: { length: 1000, height: 80, zoneId: 'x' } });
    const p = createProject([s]);
    const zones = [createZone(tile.id, { unit: 'rows', size: 3 }), createZone(tile.id, { pattern: 'herring' })];
    const q = reduce(p, { type: 'zone/replaceAll', surfaceId: s.id, zones, split: 'v' });
    expect(q.surfaces[0]).toMatchObject({ split: 'v', plinth: { zoneId: zones[0]!.id } });
    expect(reduce(q, { type: 'project/replace', project: p })).toBe(p);
    expect(reduce(q, { type: 'project/replace', project: { ...p, id: 'autre' } })).toBe(q);
  });
});
