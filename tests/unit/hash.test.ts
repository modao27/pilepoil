import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fingerprint, hash, seededRandom, stableStringify } from '../../src/core/hash';

describe('hash', () => {
  it('hash(i) inchangé (décalés aléatoires du carrelage)', () => {
    expect([0, 1, 2, 1000].map(hash)).toEqual([2151315562, 2007667912, 1091466402, 1848477635]);
  });
});

describe('générateur à graine', () => {
  it('même graine, même suite ; valeurs dans [0, 1)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const a = seededRandom(seed),
          b = seededRandom(seed);
        for (let i = 0; i < 20; i++) {
          const x = a();
          expect(x).toBe(b());
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
        }
      }),
    );
  });

  it('graines différentes, suites différentes', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe('empreinte', () => {
  it('indépendante de l’ordre des clés, sensible aux valeurs', () => {
    expect(fingerprint({ a: 1, b: [1, { c: 2, d: 'x' }] })).toBe(fingerprint({ b: [1, { d: 'x', c: 2 }], a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
    expect(fingerprint({ a: 1, b: undefined })).toBe(fingerprint({ a: 1 }));
    expect(fingerprint({ a: 1 })).toMatch(/^[0-9a-f]{14}$/);
  });

  it('texte canonique : JSON valide, même valeur', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(JSON.parse(stableStringify(v))).toEqual(JSON.parse(JSON.stringify(v)));
      }),
    );
  });
});
