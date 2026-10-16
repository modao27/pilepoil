/** H. Cloisons : réglages d'une cloison, élévation et fiche de coupe, quantités. */
import { maison, seed, test, typeIn } from './audit';

const editor = () => `/#/p/${maison().id}/m/cloisons`;

test('H1 cloison : système, hauteur, entraxe, valeurs limites', async ({ page, au }) => {
  await seed(page, 'maison', editor());
  await page.waitForTimeout(2000);
  au.note('ecran', (await page.locator('main').innerText()).slice(0, 2500));
  await au.shot('cloisons', 'reglages');
  await au.check('cloisons');
  const res: Record<string, unknown> = {};
  for (const [l, v] of [
    ['Hauteur de la cloison', '0'],
    ['Hauteur de la cloison', '600'],
    ['Hauteur de la cloison', '250'],
    ['Entraxe des montants', '10'],
    ['Entraxe des montants', '60'],
  ] as const) {
    res[`${l}=${v}`] = {
      affiche: await typeIn(page, l, v).catch(() => 'absent'),
      alertes: await page.locator('[aria-label^="Alertes"]').allInnerTexts(),
    };
  }
  au.note('limites', res);
  au.note(
    'systemes',
    await page
      .getByLabel('Système')
      .locator('option')
      .allInnerTexts()
      .catch(() => []),
  );
  await au.shot('cloisons', 'limites');
});

test('H2 élévation et fiche de coupe', async ({ page, au }) => {
  await seed(page, 'maison', `${editor()}/c/${maison().partition}`);
  await page.waitForTimeout(2500);
  au.note('ecran', (await page.locator('main').innerText()).slice(0, 3000));
  await au.shot('cloison-elevation', 'elevation');
  await au.check('cloison-elevation');
  au.note(
    'alternative-texte',
    await page.locator('svg[role=img], [role=img]').evaluateAll((s) => s.map((x) => x.getAttribute('aria-label'))),
  );
});

test('H3 quantités : rails, montants, plaques', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/resultats`);
  await page.waitForTimeout(3000);
  au.note('resultats-projet', (await page.locator('main').innerText()).slice(0, 4000));
  await page.goto(`/#/p/${maison().id}/achats`);
  await page.waitForTimeout(2500);
  const sec = page.locator('main');
  au.note(
    'achats-cloisons',
    (await sec.innerText()).split('\n').filter((l) => /Rail|Montant|Plaque|Vis|Bande|Enduit|Cloisons/.test(l)),
  );
  await au.step('zoom-rails', async () => {
    const row = page.getByText(/^Rail R48/).first();
    await row.scrollIntoViewIfNeeded();
    await au.shot('achats', 'rails-montants', { full: false });
  });
});
