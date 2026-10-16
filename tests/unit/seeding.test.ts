import { describe, expect, it } from 'vitest';
import { templatesToSeed } from '../../src/state/seeding';

const ids = ['modele-a', 'modele-b', 'lm-1', 'type-c'];

describe('modèles types posés une seule fois', () => {
  it('base vierge : tous les modèles sont posés', () => {
    const r = templatesToSeed('tiles', ids, { legacy: [], seeded: [] });
    expect(r.pose).toEqual(ids);
    expect(r.seeded).toEqual(ids.map((id) => 'tiles:' + id));
  });

  it('base amorcée avant B1 : seuls les nouveaux modèles arrivent, les anciens supprimés ne reviennent pas', () => {
    const r = templatesToSeed('tiles', ids, { legacy: ['tiles'], seeded: [] });
    expect(r.pose).toEqual(['lm-1', 'type-c']);
    expect(r.seeded).toHaveLength(4);
  });

  it('un modèle ajouté plus tard est posé, un modèle déjà posé ne l’est plus', () => {
    const first = templatesToSeed('boards', ['modele-a'], { legacy: [], seeded: [] });
    const again = templatesToSeed('boards', ['modele-a', 'lm-2'], { legacy: ['boards'], seeded: first.seeded });
    expect(again.pose).toEqual(['lm-2']);
    expect(templatesToSeed('boards', ['modele-a', 'lm-2'], { legacy: [], seeded: again.seeded }).pose).toEqual([]);
  });

  it('les bibliothèques sont indépendantes', () => {
    const tiles = templatesToSeed('tiles', ['modele-a'], { legacy: [], seeded: [] });
    expect(templatesToSeed('paints', ['modele-a'], { legacy: [], seeded: tiles.seeded }).pose).toEqual(['modele-a']);
  });
});
