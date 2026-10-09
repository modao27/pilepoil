import { describe, expect, it } from 'vitest';
import { canUndo, latest } from '../../src/state/undo';
import { createProjectStore } from '../../src/state/store';

const v = (updatedAt: number, id = 'p') => ({ id, updatedAt });

describe('annulation proposée après coup', () => {
  it('seulement si le changement annoncé est encore le dernier état connu', () => {
    expect(canUndo(v(10), v(10))).toBe(true);
    // modifié depuis (même éditeur ou autre écran)
    expect(canUndo(v(10), v(11))).toBe(false);
    // projet supprimé ou autre projet
    expect(canUndo(v(10), undefined)).toBe(false);
    expect(canUndo(v(10), v(10, 'q'))).toBe(false);
  });

  it('dernier état connu : le plus récent entre l’éditeur et la base', () => {
    expect(latest(v(10), v(12), undefined)).toEqual(v(12));
    expect(latest(undefined, null)).toBeUndefined();
  });

  it('éditeur : un second changement rend l’annulation du premier impossible', () => {
    let t = 0;
    const store = createProjectStore({ id: 'p', updatedAt: 0, n: 0 }, (d, a: number) => ({ ...d, n: d.n + a }), {
      now: () => ++t,
    });
    store.dispatch(1);
    const after = store.get().project;
    expect(canUndo(after, latest(store.get().project))).toBe(true);
    store.dispatch(1);
    expect(canUndo(after, latest(store.get().project))).toBe(false);
  });

  it('éditeur quitté : un enregistrement plus récent fait d’ailleurs bloque l’annulation', () => {
    const inEditor = v(10);
    const savedElsewhere = v(15);
    expect(canUndo(inEditor, latest(inEditor, savedElsewhere))).toBe(false);
    // rien d'autre enregistré : la base a encore l'état de l'éditeur (ou plus ancien, pas encore enregistré)
    expect(canUndo(inEditor, latest(inEditor, v(10)))).toBe(true);
    expect(canUndo(inEditor, latest(inEditor, v(5)))).toBe(true);
  });
});
