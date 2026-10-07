import { expect } from 'vitest';

/** Tolérance relative : le portage reproduit les mêmes opérations, l'écart attendu est nul. */
export const TOL = 1e-6;

/** Compare deux valeurs JSON, nombres à TOL près ; chemin dans le message en cas d'écart. */
export function expectSame(actual: unknown, expected: unknown, path = ''): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    const ok = actual === expected || Math.abs(actual - expected) <= TOL * Math.max(1, Math.abs(expected));
    if (!ok) expect.fail(`${path} : ${actual} au lieu de ${expected}`);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) expect.fail(`${path} : tableau attendu`);
    if (actual.length !== expected.length)
      expect.fail(`${path} : ${actual.length} éléments au lieu de ${expected.length}`);
    expected.forEach((e, i) => expectSame(actual[i], e, `${path}[${i}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') expect.fail(`${path} : objet attendu`);
    for (const k of Object.keys(expected)) {
      expectSame((actual as Record<string, unknown>)[k], (expected as Record<string, unknown>)[k], `${path}.${k}`);
    }
    return;
  }
  if (actual !== expected) expect.fail(`${path} : ${JSON.stringify(actual)} au lieu de ${JSON.stringify(expected)}`);
}
