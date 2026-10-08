import type { ManifestOptions } from 'vite-plugin-pwa';

/** Manifeste de l'application installable (chemins relatifs à la base de publication). */
export const manifest: Partial<ManifestOptions> = {
  id: './',
  name: 'Pilepoil — boîte à outils rénovation',
  short_name: 'Pilepoil',
  description:
    'Préparer ses travaux de rénovation : plan des pièces, carrelage, parquet, coupes, quantités et liste d’achat.',
  lang: 'fr',
  dir: 'ltr',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  // fond clair du thème (--paper) : écran de lancement sans flash
  background_color: '#e6ebee',
  theme_color: '#e6ebee',
  categories: ['productivity', 'utilities'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
  shortcuts: [
    {
      name: 'Nouveau projet',
      url: './#/new',
      icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
  ],
};
