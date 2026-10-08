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
        // La parité tourne dans Chromium, le moteur où les références legacy ont été extraites :
        // Math.sin/cos peuvent différer d'un ulp entre moteurs JavaScript (voir tests/parity/README.md).
        extends: true,
        test: {
          name: 'parity',
          include: ['tests/parity/**/*.test.ts'],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
        },
      },
    ],
  },
});
