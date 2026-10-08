import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { VitePWA } from 'vite-plugin-pwa';
import { manifest } from './src/pwa/manifest.ts';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Base relative : le site statique fonctionne à la racine d'un domaine comme dans un sous-dossier
  // (navigation par #, aucune réécriture d'URL à configurer chez l'hébergeur).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    svelte(),
    VitePWA({
      // Nouvelle version : message « Mettre à jour » plutôt qu'un rechargement imposé en plein calepinage.
      registerType: 'prompt',
      injectRegister: false,
      manifest,
      // déjà pris par globPatterns (public/)
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Polices vietnamiennes et modules facultatifs de jsPDF (export HTML, SVG) que l'application n'utilise pas.
        globIgnores: ['**/*-vietnamese-*', '**/html2canvas-*.js', '**/purify.es-*.js', '**/index.es-*.js'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
