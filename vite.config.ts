import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [svelte()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        // Dans Chromium : parité (moteur où les références legacy ont été extraites, Math.sin/cos pouvant
        // différer d'un ulp entre moteurs JavaScript, voir tests/parity/README.md) et stockage (vrai IndexedDB).
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/parity/**/*.test.ts', 'tests/browser/**/*.test.ts'],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
        },
      },
    ],
  },
});
