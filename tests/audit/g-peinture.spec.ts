/** G. Peinture : murs, produit, couches, teintes, boiseries, déductions, chiffres, crédence. */
import type { Page } from '@playwright/test';
import { maison, openSheet, panel, seed, test, typeIn } from './audit';

const poseUrl = (i: number) => `/#/p/${maison().id}/m/peinture/pose/${maison().poses[i]!.id}`;
const summary = (page: Page) =>
  page
    .locator('a.summary')
    .first()
    .innerText()
    .catch(() => '');

async function stepTab(page: Page, name: string) {
  await openSheet(page);
  await panel(page).getByRole('tab', { name, exact: true }).click();
  await page.waitForTimeout(300);
}

test('G1 murs, produit, couches, teintes', async ({ page, au }) => {
  await seed(page, 'maison', poseUrl(3));
  await page.waitForTimeout(1500);
  au.note('resume', await summary(page));
  for (const s of ['Produit', 'Pose', 'Découpage', 'Finitions', 'Avancé']) {
    await stepTab(page, s);
    au.note(`${s}:controles`, await panel(page).locator('label, legend, h2, h3').allInnerTexts());
    await au.shot('pose-peinture-mur', `etape-${s}`);
  }
  await stepTab(page, 'Produit');
  au.note(
    'peintures',
    await panel(page)
      .getByLabel('Peinture', { exact: true })
      .locator('option')
      .allInnerTexts()
      .catch(() => []),
  );
  const res: Record<string, unknown> = {};
  for (const v of ['1', '2', '3', '0', '10']) {
    res[`couches=${v}`] = { affiche: await typeIn(panel(page), /Couches/, v).catch(() => 'absent') };
    await page.waitForTimeout(1000);
    (res[`couches=${v}`] as Record<string, unknown>)['resume'] = await summary(page);
  }
  au.note('couches', res);
  await au.step('teinte', async () => {
    const t = panel(page)
      .getByRole('button', { name: /Teinte des murs/ })
      .or(panel(page).getByLabel('Teinte des murs'))
      .first();
    await t.click();
    await page.waitForTimeout(400);
    await au.shot('pose-peinture-mur', 'teintes');
    au.note('teintes', (await page.getByRole('dialog').or(panel(page)).first().innerText()).slice(0, 800));
    await au.check('peinture-teintes');
  });
});

test('G2 boiseries, plinthes, déductions', async ({ page, au }) => {
  await seed(page, 'maison', poseUrl(3));
  await page.waitForTimeout(1500);
  await stepTab(page, 'Finitions');
  au.note('finitions', (await panel(page).innerText()).slice(0, 1500));
  await stepTab(page, 'Découpage');
  au.note('decoupage', (await panel(page).innerText()).slice(0, 1500));
  for (const [l, v] of [
    ['Déduire au-delà de', '0'],
    ['Hauteur des plinthes', '500'],
    ['Perte de chantier', '-5'],
  ] as const)
    au.note(`${l}=${v}`, {
      affiche: await typeIn(panel(page), l, v).catch(() => 'absent'),
      resume: await summary(page),
    });
});

test('G3 chiffres : mur 3 du séjour, litres et pots', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/pose/${maison().poses[3]!.id}/resultats`);
  await page.waitForTimeout(2500);
  au.note('resume', (await page.locator('main').innerText()).slice(0, 3000));
  await page.getByRole('tab', { name: 'Détail' }).click();
  await page.waitForTimeout(800);
  au.note('detail', (await page.locator('main').innerText()).slice(0, 4000));
  await au.shot('resultats-pose', 'peinture-detail');
  await page.goto(poseUrl(3));
  await page.waitForTimeout(1500);
  au.note(
    'reglages',
    await panel(page)
      .locator('input, select')
      .evaluateAll((is) => is.map((i) => `${i.getAttribute('aria-label') ?? i.id}=${(i as HTMLInputElement).value}`)),
  );
});

test('G4 peinture au-dessus d’une crédence', async ({ page, au }) => {
  await seed(page, 'maison', poseUrl(2));
  await page.waitForTimeout(1500);
  au.note('resume', await summary(page));
  await au.shot('pose-peinture', 'au-dessus-credence', { full: false });
  await page.goto(`/#/p/${maison().id}/pose/${maison().poses[2]!.id}/resultats`);
  await page.waitForTimeout(2500);
  await page.getByRole('tab', { name: 'Détail' }).click();
  await page.waitForTimeout(800);
  au.note('detail', (await page.locator('main').innerText()).slice(0, 3000));
});
