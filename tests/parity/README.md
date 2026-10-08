# Tests de parité avec legacy

- `configs.ts` : configurations de référence, au format de sauvegarde legacy (surface active = 0).
- `npm run parity:extract` : charge `legacy/calepinage.html` dans Chromium (Playwright), expose en mémoire
  ses fonctions internes et écrit `fixtures/legacy-results.json` (avec l'empreinte SHA-256 du fichier legacy).
  À relancer si `configs.ts` ou legacy change.
- `parity.test.ts` : compare le moteur (`src/core`) aux références, nombres à 1e-6 près, comptes exacts.

## Pourquoi dans Chromium

Les tests de parité tournent dans Chromium (mode navigateur de Vitest), pas sous Node. `Math.sin` et
`Math.cos` peuvent différer d'un ulp d'un moteur JavaScript à l'autre : par exemple `Math.sin(4π/3)` vaut
`-0.8660254037844385` sous Node 24 et `-0.8660254037844384` dans Chromium. Pour les hexagones, des pièces
d'aires géométriquement égales sont alors départagées dans un autre ordre, et le réemploi des chutes apparie
d'autres pièces (même résultat métier, numérotation différente).

legacy a donc lui-même des résultats qui dépendent légèrement du navigateur. La parité est exacte dans le
moteur où les références ont été extraites.

## Fichiers locaux

`*.local.ts` sont des scripts de débogage ponctuels, non versionnés.
