// À fusionner dans vite.config.ts → VitePWA({ manifest: … })
// Copier le dossier pwa/ (PNG + favicon) dans public/ et app/favicon.svg dans public/.
export const manifest = {
  name: 'PilePoil',
  short_name: 'PilePoil',
  description: 'Vos travaux, au millimètre près. Calepinage, plans et listes d\'achat pour la rénovation.',
  lang: 'fr',
  theme_color: '#174F50',
  background_color: '#FAF1E9',
  display: 'standalone',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
