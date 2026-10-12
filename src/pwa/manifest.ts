import type { ManifestOptions } from 'vite-plugin-pwa';
import { appName, brand, tagline } from '../ui/brand.ts';

/** Manifeste de l'application installable (chemins relatifs à la base de publication). */
export const manifest: Partial<ManifestOptions> = {
  id: './',
  name: appName,
  short_name: appName,
  description: `${tagline} Plan des pièces, carrelage, parquet, coupes, quantités et liste d’achat.`,
  lang: 'fr',
  dir: 'ltr',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  // écran de lancement ivoire (--color-bg), barre d'état pétrole (identité)
  background_color: brand.ivoire,
  theme_color: brand.petrole,
  categories: ['productivity', 'utilities'],
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
  shortcuts: [
    {
      name: 'Nouveau projet',
      url: './#/new',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
  ],
};
