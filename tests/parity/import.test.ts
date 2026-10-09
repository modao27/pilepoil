/**
 * Critère de la phase 2 : un projet legacy importé redonne les mêmes résultats.
 * Chaque configuration de référence passe par la sauvegarde legacy brute → import → modèle → moteur,
 * et doit donner exactement le résultat de la conversion directe (lui-même identique à legacy).
 */
import { describe, expect, it } from 'vitest';
import { computeProject, type ProjectResult } from '../../src/modules/carrelage/core';
import { convertLegacy, EMPTY_STORAGE, readLegacyProject } from '../../src/modules/carrelage/storage/legacy/convert';
import { expectSame } from './compare';
import configs from './configs';
import fixtureRaw from './fixtures/legacy-results.json?raw';
import { fromLegacy } from './fromLegacy';
import { v1Spec } from './v1Spec';

const summary = (R: ProjectResult) => ({
  surfaces: R.surfaces.map((s) => (s.ok ? { ok: true, warnings: s.value.warnings } : { ok: false, error: s.error })),
  pieces: R.pieces,
  plan: R.plan,
  metrics: R.metrics,
  glue: R.glue,
  shopping: R.shopping,
});

const fixture = JSON.parse(fixtureRaw) as { results: Record<string, { input: unknown }> };

describe.each(configs.map((c) => [c.name, c] as const))('import legacy : %s', (name, cfg) => {
  it('normalisation identique à legacy (normSurface)', () => {
    const store = { ...EMPTY_STORAGE, 'calepinage-v3': JSON.stringify(cfg.project) };
    expectSame(readLegacyProject(store), fixture.results[name]!.input, 'normalisé');
  });

  it('mêmes résultats que legacy', () => {
    const store = { ...EMPTY_STORAGE, 'calepinage-v3': JSON.stringify(cfg.project) };
    const imported = convertLegacy(store, 0);
    expect(imported.project).not.toBeNull();
    const { spec, missing } = v1Spec(imported.project!, imported.tiles);
    expect(missing).toEqual([]);
    const direct = computeProject(fromLegacy(readLegacyProject(store)!));
    expectSame(summary(computeProject(spec)), summary(direct), 'résultat');
  });
});
