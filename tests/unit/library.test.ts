import { describe, expect, it } from 'vitest';
import { createTile } from '../../src/state/factories';
import { createLibraryStore } from '../../src/state/library';

describe('bibliothèque de carreaux', () => {
  it('tri par nom, ajout, modification horodatée, enregistrement', () => {
    const saved: string[] = [];
    const lib = createLibraryStore([createTile({ name: 'Zellige' }), createTile({ name: 'émail' })], {
      isUsed: () => false,
      onSave: (t) => saved.push(t.name),
      now: () => 42,
    });
    expect(lib.get().map((t) => t.name)).toEqual(['émail', 'Zellige']);
    const ardoise = createTile({ name: 'Ardoise' });
    lib.put(ardoise);
    lib.update(ardoise.id, { name: 'Ardoise noire', color: '#222222' });
    expect(lib.get().map((t) => t.name)).toEqual(['Ardoise noire', 'émail', 'Zellige']);
    expect(lib.get()[0]).toMatchObject({ color: '#222222', updatedAt: 42 });
    expect(saved).toEqual(['Ardoise', 'Ardoise noire']);
  });

  it('refuse de supprimer un carreau utilisé', () => {
    const used = createTile(),
      free = createTile();
    const deleted: string[] = [];
    const lib = createLibraryStore([used, free], {
      isUsed: (id) => id === used.id,
      onDelete: (id) => deleted.push(id),
    });
    let notified = 0;
    lib.subscribe(() => notified++);
    expect(lib.remove(used.id)).toBe(false);
    expect(lib.remove(free.id)).toBe(true);
    expect(lib.get()).toEqual([used]);
    expect(deleted).toEqual([free.id]);
    expect(notified).toBe(2);
  });
});
