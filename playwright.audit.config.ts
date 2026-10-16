/**
 * Audit UI/UX (docs/audit/) : séparé des tests e2e, lancé par `npm run test:audit`. Les scénarios relèvent des
 * constats sans échouer sur eux ; un test rouge veut dire que le scénario n'a pas pu aller au bout.
 * Matrice : docs/audit/CARTOGRAPHIE.md §5 (29 appareils).
 */
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

type Project = NonNullable<PlaywrightTestConfig['projects']>[number];

const PORT = 4174;

/** Téléphone : taille portrait, moteur ; paysage en inversant les côtés. */
function phone(w: number, h: number, engine: 'chromium' | 'webkit', landscape: boolean): Project {
  const base = engine === 'webkit' ? devices['iPhone 13'] : devices['Pixel 7'];
  const viewport = landscape ? { width: h, height: w } : { width: w, height: h };
  return {
    name: `tel-${w}x${h}-${landscape ? 'paysage' : 'portrait'}-${engine}`,
    use: { ...base, viewport, isMobile: true, hasTouch: true },
  };
}

function tablet(w: number, h: number, landscape: boolean): Project {
  const viewport = landscape ? { width: h, height: w } : { width: w, height: h };
  return {
    name: `tab-${w}x${h}-${landscape ? 'paysage' : 'portrait'}-webkit`,
    use: { ...devices['iPad Pro 11'], viewport, isMobile: true, hasTouch: true },
  };
}

function desktop(w: number, h: number, engine: 'chromium' | 'firefox' | 'webkit'): Project {
  const base =
    engine === 'firefox'
      ? devices['Desktop Firefox']
      : engine === 'webkit'
        ? devices['Desktop Safari']
        : devices['Desktop Chrome'];
  return { name: `pc-${w}x${h}-${engine}`, use: { ...base, viewport: { width: w, height: h } } };
}

const phones: Project[] = (
  [
    [360, 740],
    [375, 667],
    [390, 844],
    [430, 932],
  ] as const
).flatMap(([w, h]) => (['chromium', 'webkit'] as const).flatMap((e) => [phone(w, h, e, false), phone(w, h, e, true)]));
const tablets: Project[] = [
  tablet(768, 1024, false),
  tablet(768, 1024, true),
  tablet(1024, 1366, false),
  tablet(1024, 1366, true),
];
const desktops: Project[] = (
  [
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ] as const
).flatMap(([w, h]) => (['chromium', 'firefox', 'webkit'] as const).map((e) => desktop(w, h, e)));

export default defineConfig({
  testDir: 'tests/audit',
  testMatch: /\.(spec|setup)\.ts$/,
  outputDir: 'test-results/audit',
  fullyParallel: true,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'docs/audit/captures-local/resultats.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    acceptDownloads: true,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [...phones, ...tablets, ...desktops],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
