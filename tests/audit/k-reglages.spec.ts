/** K. Réglages, aide, à propos. */
import { test } from './audit';

test('K1 réglages : thème, épaisseur, favori, mise à jour, version', async ({ page, au }) => {
  await page.goto('/#/settings');
  await page.getByRole('heading', { name: 'Réglages' }).waitFor();
  await page.waitForTimeout(800);
  au.note('texte', (await page.locator('main').innerText()).slice(0, 3000));
  await au.shot('reglages', 'clair');
  for (const t of ['Sombre', 'Clair', 'Automatique']) {
    await page.getByRole('radio', { name: t }).click();
    await page.waitForTimeout(400);
    au.note(
      `theme-${t}`,
      await page.evaluate(() => ({
        theme: document.documentElement.dataset['theme'] ?? 'auto',
        fond: getComputedStyle(document.body).backgroundColor,
        meta: [...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.getAttribute('content')),
      })),
    );
    if (t === 'Sombre') await au.shot('reglages', 'sombre');
  }
  await page.reload();
  au.note('theme-garde', await page.evaluate(() => document.documentElement.dataset['theme'] ?? 'auto'));
  await au.step('copier-favori', async () => {
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])
      .catch(() => undefined);
    await page.getByRole('button', { name: 'Copier le favori' }).click();
    await page.waitForTimeout(400);
    au.note('favori', await page.getByRole('status').allInnerTexts());
  });
  await au.step('maj', async () => {
    await page.getByRole('button', { name: /Rechercher une mise à jour/ }).click();
    await page.waitForTimeout(3000);
    au.note('maj', await page.getByRole('status').allInnerTexts());
  });
  await au.check('reglages');
});

test('K2 aide, à propos, système de design', async ({ page, au }) => {
  await page.goto('/#/settings');
  await page.getByRole('heading', { name: 'Réglages' }).waitFor();
  au.note(
    'a-propos',
    await page
      .getByRole('region', { name: 'À propos' })
      .innerText()
      .catch(() => ''),
  );
  au.note('aide', {
    liens: await page.getByRole('link', { name: /aide|guide|mode d’emploi|tutoriel/i }).count(),
    mots: await page.getByText(/aide/i).count(),
  });
  await page.getByRole('link', { name: 'Voir le système de design' }).click();
  await page.waitForTimeout(800);
  au.note('demo', { url: page.url().replace(/^.*#/, '#'), h1: await page.locator('h1').allInnerTexts() });
  await au.shot('design', 'demo');
  await au.check('design');
});
