import { describe, expect, it } from 'vitest';
import { upsertItem } from '../../src/ui/lib/library';

const item = (id: string, name: string) => ({ id, name, updatedAt: 0 });

describe('listes des bibliothèques', () => {
  it('tri par nom en français (accents, nombres), remplacement par identifiant', () => {
    let l = upsertItem([], item('a', 'Zellige'));
    l = upsertItem(l, item('b', 'émail'));
    l = upsertItem(l, item('c', 'Carreau 10'));
    l = upsertItem(l, item('d', 'Carreau 9'));
    expect(l.map((x) => x.name)).toEqual(['Carreau 9', 'Carreau 10', 'émail', 'Zellige']);
    const renamed = upsertItem(l, item('b', 'Ardoise'));
    expect(renamed.map((x) => x.id)).toEqual(['b', 'd', 'c', 'a']);
    expect(l).toHaveLength(4);
  });
});
