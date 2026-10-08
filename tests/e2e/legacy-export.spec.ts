import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { convertLegacy } from '../../src/storage/legacy/convert';
import { parseLegacyExport } from '../../src/storage/legacy/import';

const legacy = readFileSync(new URL('../../legacy/calepinage.html', import.meta.url), 'utf8');
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

test('legacy : « Exporter mes données » produit un fichier que la nouvelle version importe', async ({ page }) => {
  await page.route('**/*', (route) =>
    route.request().url() === 'http://legacy.test/'
      ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: legacy })
      : route.abort(),
  );
  await page.addInitScript((photo) => {
    if (localStorage.getItem('calepinage-v3')) return;
    localStorage.setItem(
      'calepinage-v3',
      JSON.stringify({
        surfaces: [
          { name: 'Mur douche', W: 1800, H: 2100, zones: [{ pattern: 'herring', photo: 'ph1' }] },
          { kind: 'floor' },
        ],
        active: 0,
        room: null,
        prices: { colle: 21 },
        photos: { ph1: photo },
      }),
    );
    localStorage.setItem('calepinage-nuancier', JSON.stringify({ tiles: ['#123456'], grouts: ['#654321'] }));
  }, PHOTO);
  await page.goto('http://legacy.test/');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter mes données' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^calepinage-export-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByRole('status').filter({ hasText: 'Fichier enregistré' })).toBeVisible();

  const text = readFileSync(await download.path(), 'utf8');
  const r = convertLegacy(parseLegacyExport(text), 0);
  expect(r.project!.surfaces.map((s) => [s.name, s.kind, s.width])).toEqual([
    ['Mur douche', 'wall', 1800],
    ['Surface 1', 'floor', 3000],
  ]);
  expect(r.project!.surfaces[0]!.zones[0]!.pattern).toBe('herring');
  expect(r.project!.prices).toEqual({ colle: 21 });
  expect(r.photos.map((p) => p.dataUrl)).toEqual([PHOTO]);
  expect(r.palette).toEqual({ tiles: ['#123456'], grouts: ['#654321'] });
});
