import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaver } from '../../src/storage/autosave';
import { FutureVersionError, migrate, migrateProject, type Step } from '../../src/storage/migrations';
import { createProject } from '../../src/modules/carrelage/state/factories';

describe('migrations de documents', () => {
  const steps: Record<number, Step> = {
    0: (d) => ({ ...d, name: d.nom, nom: undefined }),
    1: (d) => ({ ...d, tags: [] }),
  };

  it('enchaîne les étapes depuis la version du document', () => {
    const { doc, changed } = migrate<Record<string, unknown>>({ nom: 'Cuisine' }, 2, steps);
    expect(changed).toBe(true);
    expect(doc).toMatchObject({ name: 'Cuisine', tags: [], schemaVersion: 2 });
    expect(migrate({ schemaVersion: 1, name: 'x' }, 2, steps).doc).toMatchObject({ tags: [], schemaVersion: 2 });
  });

  it('document à jour : inchangé', () => {
    const p = createProject([]);
    const r = migrateProject(p);
    expect(r.changed).toBe(false);
    expect(r.doc).toBe(p);
  });

  it('erreurs : version future, étape manquante, document illisible', () => {
    expect(() => migrate({ schemaVersion: 3 }, 2, steps)).toThrow(FutureVersionError);
    expect(() => migrate({ schemaVersion: 0 }, 2, { 1: steps[1]! })).toThrow(/manquante/);
    expect(() => migrate(null, 2, steps)).toThrow(/illisible/);
  });
});

describe('enregistrement différé', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('regroupe les écritures rapprochées et garde la dernière valeur', async () => {
    const written: number[] = [];
    const s = createSaver<number>(async (v) => void written.push(v), 300);
    s.schedule(1);
    s.schedule(2);
    await vi.advanceTimersByTimeAsync(299);
    expect(written).toEqual([]);
    s.schedule(3);
    await vi.advanceTimersByTimeAsync(300);
    expect(written).toEqual([3]);
  });

  it('flush écrit tout de suite, sans double écriture', async () => {
    const written: number[] = [];
    const s = createSaver<number>(async (v) => void written.push(v), 300);
    s.schedule(7);
    await s.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(written).toEqual([7]);
  });

  it('une erreur d’écriture est signalée sans bloquer les suivantes', async () => {
    const errors: unknown[] = [],
      written: number[] = [];
    const s = createSaver<number>(
      async (v) => {
        if (v === 1) throw new Error('plein');
        written.push(v);
      },
      10,
      (e) => errors.push(e),
    );
    s.schedule(1);
    await s.flush();
    s.schedule(2);
    await s.flush();
    expect(errors).toHaveLength(1);
    expect(written).toEqual([2]);
  });
});
