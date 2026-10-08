// Remplace le service worker de l'ancienne appli « Calepinage » : il s'active aussitôt, vide ses seuls caches
// (même origine que Pilepoil : on ne touche pas aux autres), se désinstalle et recharge les fenêtres ouvertes,
// qui tombent alors sur la page de redirection.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      for (const key of await caches.keys())
        if (key.includes(scope) || key.includes('/calepinage-pwa/')) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
