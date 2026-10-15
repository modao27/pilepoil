/**
 * Chaque erreur bloquante de `toSpec` a un texte (docs/BOITE.md §2) : les codes sont relevés dans les sources des
 * modules, pour qu'un code ajouté sans message fasse échouer ce test.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { modules } from '../../src/modules/registry';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('messages des erreurs de toSpec', () => {
  for (const m of modules)
    it(m.id, async () => {
      const src = files(`src/modules/${m.id}/state`).map((f) => readFileSync(f, 'utf8'));
      const codes = [...new Set(src.flatMap((s) => [...s.matchAll(/code: '([a-z]+\/[a-z-]+)'/g)].map((x) => x[1]!)))];
      expect(codes.length).toBeGreaterThan(0);
      const results = await m.results();
      for (const code of codes) expect(results.errorText({ code }), code).not.toMatch(/vérifiez les réglages/);
    });
});
