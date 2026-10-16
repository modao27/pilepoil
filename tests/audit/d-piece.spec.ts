/** D. Écran Pièce : sélection, revêtir, continuer une pose, découper, zones de mur, changer, retirer. */
import type { Page } from '@playwright/test';
import { createProject } from '../e2e/helpers';
import { maison, seed, tap, test, typeIn } from './audit';

const drawing = (page: Page) => page.getByRole('group', { name: /sol au centre, murs dépliés/ });
const surfaceBtn = (page: Page, name: RegExp) => drawing(page).getByRole('button', { name });

test('D1 sélection : toucher le dessin, clavier, liste', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/r/${m.rooms['Séjour']}`);
  await drawing(page).waitFor();
  au.note(
    'surfaces-accessibles',
    await drawing(page)
      .getByRole('button')
      .evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label'))),
  );
  // toucher le mur 2 sur le dessin
  await au.step('toucher-mur', async () => {
    const b = (await surfaceBtn(page, /^Mur 2/).boundingBox())!;
    await tap(page, b.x + b.width / 2, b.y + b.height / 2, au.isTouch);
    await page.waitForTimeout(400);
    au.note('apres-toucher', {
      url: page.url().replace(/^.*#/, '#'),
      titre: await page.locator('main h2').first().innerText(),
    });
    await au.shot('piece', 'mur-2');
  });
  // glisser sur le dessin ne doit pas sélectionner
  await au.step('glisser', async () => {
    const b = (await surfaceBtn(page, /^Sol/).boundingBox())!;
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    await page.mouse.move(b.x + 60, b.y + 60, { steps: 6 });
    await page.mouse.up();
    au.note('apres-glisser', page.url().replace(/^.*#/, '#'));
  });
  // clavier
  await surfaceBtn(page, /^Sol/).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  au.note('clavier-entree', page.url().replace(/^.*#/, '#'));
  au.note(
    'cibles-dessin',
    await drawing(page)
      .getByRole('button')
      .evaluateAll((bs) =>
        bs.map(
          (b) =>
            `${b.getAttribute('aria-label')?.slice(0, 20)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`,
        ),
      ),
  );
  await au.shot('piece', 'sol');
  await au.check('piece-sol');
  // retour navigateur après plusieurs sélections : remonte-t-on d'un niveau ?
  await page.goBack();
  await page.waitForTimeout(300);
  au.note('retour-apres-selections', page.url().replace(/^.*#/, '#'));
});

test('D2 revêtir avec chaque outil ; parquet sur un mur', async ({ page, au }) => {
  const id = await createProject(page, { project: 'D2', name: 'Chambre', size: [350, 300] });
  await page.goto(`/#/p/${id}`);
  await page
    .getByRole('link', { name: /^Chambre/ })
    .first()
    .click();
  await drawing(page).waitFor();
  await au.shot('piece', 'vierge');
  for (const s of ['Sol', 'Mur 1']) {
    await page
      .getByRole('button', { name: new RegExp(`^${s}( \\(| :)`) })
      .first()
      .click();
    await page.waitForTimeout(300);
    au.note(`${s}:outils`, await page.getByRole('button', { name: /^Revêtir/ }).allInnerTexts());
    au.note(`${s}:grise`, await page.locator('button[disabled]').allInnerTexts());
    await au.shot('piece', `outils-${s}`);
  }
  // revêtir le sol en parquet : où mène-t-on ? combien de taps jusqu'au calepinage ?
  await page
    .getByRole('button', { name: /^Sol( \(| :)/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Revêtir : parquet' }).click();
  await page.waitForTimeout(500);
  au.note('apres-revetir', {
    url: page.url().replace(/^.*#/, '#'),
    liens: await page.getByRole('link', { name: /Calepinage|Réglages/ }).allInnerTexts(),
  });
  await au.shot('piece', 'sol-parquet');
  await page.getByRole('link', { name: 'Calepinage' }).first().click();
  await page.waitForTimeout(2000);
  await au.shot('calepinage-parquet', 'premiere-ouverture');
  au.note('calepinage-titre', await page.locator('h1').allInnerTexts());
  // la peinture sur le mur 1
  await page.goBack();
  await page
    .getByRole('button', { name: /^Mur 1( \(| :)/ })
    .first()
    .click();
  await au.step('peindre-mur', () => page.getByRole('button', { name: 'Revêtir : peinture' }).click());
  au.note('libelle-peinture', await page.getByRole('link', { name: /Calepinage|Réglages/ }).allInnerTexts());
});

test('D3 continuer une pose voisine ou nouvelle pose', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/r/${m.rooms['Salle de bain']}/${''}`);
  await page
    .getByRole('button', { name: /^Mur 3( \(| :)/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Revêtir : carrelage' }).click();
  const d = page.getByRole('dialog');
  au.note('fenetre', await d.innerText().catch(() => 'aucune'));
  await au.shot('piece', 'continuer-ou-nouvelle');
  await au.check('piece-continuer');
  await au.step('continuer', () =>
    d
      .getByRole('button', { name: /^Continuer/ })
      .first()
      .click(),
  );
  await page.waitForTimeout(500);
  au.note(
    'liste-surfaces',
    await page
      .getByRole('region', { name: 'Sol et murs' })
      .innerText()
      .catch(() => ''),
  );
  // mur non contigu (mur 5 du L) : proposé ?
  await page
    .getByRole('button', { name: /^Mur 5( \(| :)/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Revêtir : carrelage' }).click();
  au.note(
    'mur-5-fenetre',
    await page
      .getByRole('dialog')
      .innerText()
      .catch(() => 'aucune (nouvelle pose directe)'),
  );
  await page.keyboard.press('Escape');
});

test('D4 découper un sol par une ligne et par un contour', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/r/${m.rooms['Salle de bain']}/sol`);
  await page.getByRole('button', { name: 'Découper par une ligne' }).click();
  await au.shot('piece', 'decoupe-ligne');
  const b = (await surfaceBtn(page, /^Sol/).boundingBox())!;
  await tap(page, b.x + b.width * 0.3, b.y + b.height * 0.1, au.isTouch);
  await tap(page, b.x + b.width * 0.3, b.y + b.height * 0.9, au.isTouch);
  await page.waitForTimeout(600);
  au.note('ligne', {
    toast: await page.getByRole('status').allInnerTexts(),
    zones: await page.locator('.zones li').count(),
  });
  await au.shot('piece', 'decoupe-ligne-faite');
  // contour sur une des zones
  await au.step('contour', async () => {
    await page.getByRole('button', { name: 'Découper par un contour' }).first().click();
    for (const [x, y] of [
      [0.1, 0.1],
      [0.3, 0.1],
      [0.3, 0.3],
      [0.1, 0.3],
    ] as const) {
      await tap(page, b.x + b.width * x, b.y + b.height * y, au.isTouch);
      await page.waitForTimeout(200);
    }
    await au.shot('piece', 'contour-4-points');
    await page.getByRole('button', { name: 'Fermer le contour' }).click();
    await page.waitForTimeout(600);
    au.note('contour', {
      toast: await page.getByRole('status').allInnerTexts(),
      zones: await page.locator('.zones li').count(),
    });
    await au.shot('piece', 'contour-fait');
  });
  // vue globale : comment sont nommées les nouvelles poses ?
  await page.goto(`/#/p/${m.id}`);
  await page.waitForTimeout(1500);
  au.note(
    'vue-globale',
    (
      await page
        .getByRole('region', { name: 'Pièces' })
        .innerText()
        .catch(() => '')
    ).slice(0, 800),
  );
});

test('D5 zone de mur (crédence) et partie libre', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/r/${m.rooms['Séjour']}/${'sol'}`);
  await page
    .getByRole('button', { name: /^Mur 1( \(| :)/ })
    .first()
    .click();
  await au.shot('piece', 'mur-1-zones');
  const res: Record<string, unknown> = {};
  for (const [from, to] of [
    ['90', '150'],
    ['150', '90'],
    ['0', '400'],
    ['-10', '120'],
  ] as const) {
    await typeIn(page.locator('.zones li').first(), 'Depuis le sol', from);
    await typeIn(page.locator('.zones li').first(), 'Jusqu’à', to);
    res[`${from}-${to}`] = {
      depuis: await page.locator('.zones li').first().getByLabel('Depuis le sol', { exact: true }).inputValue(),
      jusqua: await page.locator('.zones li').first().getByLabel('Jusqu’à', { exact: true }).inputValue(),
      toast: await page.getByRole('status').allInnerTexts(),
      libre: await page.locator('.free').allInnerTexts(),
    };
  }
  au.note('hauteurs', res);
  await au.shot('piece', 'credence-hauteurs');
});

test('D6 changer de revêtement, retirer, annuler', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/r/${m.rooms['Séjour']}/sol`);
  au.note('actions-zone', await page.locator('.zones li').first().getByRole('button').allInnerTexts());
  await au.step('passer', async () => {
    await page
      .getByRole('button', { name: /^Passer en carrelage/ })
      .first()
      .click();
    await page.waitForTimeout(500);
    au.note('passer', {
      fenetre: await page.getByRole('dialog').count(),
      toast: await page.getByRole('status').allInnerTexts(),
    });
    await au.shot('piece', 'passe-carrelage');
    await page.getByRole('button', { name: 'Annuler' }).last().click();
    await page.waitForTimeout(500);
    au.note('apres-annuler', await page.locator('.zones li').first().innerText());
  });
  await au.step('retirer', async () => {
    await page.getByRole('button', { name: 'Retirer' }).first().click();
    await page.waitForTimeout(400);
    au.note('retirer', {
      fenetre: await page.getByRole('dialog').count(),
      toast: await page.getByRole('status').allInnerTexts(),
    });
    await au.shot('piece', 'zone-retiree');
    // la pose existe-t-elle encore (réglages perdus ?) : retour au projet
    await page.goto(`/#/p/${m.id}`);
    await page.waitForTimeout(1500);
    au.note(
      'projet-apres-retrait',
      (
        await page
          .getByRole('region', { name: 'Pièces' })
          .innerText()
          .catch(() => '')
      ).slice(0, 400),
    );
  });
});
