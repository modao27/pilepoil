/** J. Achats consolidés, exports PDF et CSV, bibliothèques (créer, modifier, supprimer, utilisé), fiches collées. */
import { readFileSync, statSync } from 'node:fs';
import { maison, pdfText, seed, test } from './audit';

const shop = () => `/#/p/${maison().id}/achats`;

test('J1 liste consolidée des quatre outils', async ({ page, au }) => {
  await seed(page, 'maison', shop());
  await page.waitForTimeout(3000);
  const text = await page.locator('main').innerText();
  au.note('texte', text.slice(0, 5000));
  // lignes dont la quantité manque : « Cloisons · » suivi de rien
  au.note(
    'quantites-vides',
    text.split('\n').filter((l) => /^(Carrelage|Parquet|Peinture|Cloisons) ·\s*$/.test(l.trim())),
  );
  au.note('groupes', await page.locator('main h2').allInnerTexts());
  await au.shot('achats', 'liste');
  await au.check('achats');
});

test('J2 prix modifiés, totaux, annuler, rechargement', async ({ page, au }) => {
  await seed(page, 'maison', shop());
  await page.waitForTimeout(3000);
  const field = page.getByRole('textbox', { name: /^Prix / }).nth(1);
  const total = () =>
    page
      .getByText(/^Total estimé/)
      .innerText()
      .catch(() => '');
  const res: Record<string, unknown> = {};
  for (const v of ['12,5', '12.5', '1 000,50', 'abc', '-3', '0', '']) {
    await field.fill(v);
    await field.press('Enter');
    await page.waitForTimeout(500);
    res[JSON.stringify(v)] = {
      affiche: await field.inputValue(),
      total: await total(),
      toast: await page.getByRole('status').allInnerTexts(),
      invalide: await field.getAttribute('aria-invalid'),
    };
  }
  au.note('saisies', res);
  au.note('clavier', { inputmode: await field.getAttribute('inputmode'), type: await field.getAttribute('type') });
  await field.fill('19,90');
  await field.press('Enter');
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForTimeout(2500);
  au.note('apres-rechargement', { valeur: await field.inputValue(), total: await total() });
  await au.shot('achats', 'prix');
});

test('J3 PDF des achats : ouvert et vérifié', async ({ page, au }) => {
  await seed(page, 'maison', shop());
  await page.waitForTimeout(3000);
  await au.step('pdf', async () => {
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: 'Exporter en PDF' }).click(),
    ]);
    const path = await d.path();
    au.note('pdf', {
      nom: d.suggestedFilename(),
      octets: statSync(path).size,
      message: await page.getByRole('status').allInnerTexts(),
    });
    au.note('pdf-texte', await pdfText(path, 3000));
  });
});

test('J4 CSV des achats : ouvert et vérifié', async ({ page, au }) => {
  await seed(page, 'maison', shop());
  await page.waitForTimeout(3000);
  await au.step('csv', async () => {
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: 'Exporter pour un tableur' }).click(),
    ]);
    const buf = readFileSync((await d.path())!);
    const txt = buf.toString('utf8');
    au.note('csv', {
      nom: d.suggestedFilename(),
      bom: buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf,
      separateur: (txt.split('\n')[0]!.match(/;/g) ?? []).length ? ';' : ',',
      lignes: txt.split(/\r?\n/).length,
      finDeLigne: txt.includes('\r\n') ? 'CRLF' : 'LF',
      debut: txt.slice(0, 1500),
      virguleDecimale: /\d,\d/.test(txt),
    });
    au.note('message', await page.getByRole('status').allInnerTexts());
  });
});

test('J5 bibliothèques : créer, modifier, dupliquer, supprimer', async ({ page, au }) => {
  await seed(page, 'maison', '/#/library/tiles');
  for (const [lib, add] of [
    ['tiles', 'Ajouter un carreau'],
    ['boards', 'Ajouter une lame'],
    ['paints', 'Ajouter une peinture'],
    ['systems', 'Ajouter un système'],
  ] as const) {
    await page.goto(`/#/library/${lib}`);
    await page.waitForTimeout(800);
    au.note(`${lib}:liste`, {
      elements: await page.locator('main li').count(),
      recherche: await page.getByRole('searchbox').count(),
      onglets: await page
        .getByRole('navigation')
        .first()
        .innerText()
        .catch(() => ''),
    });
    await au.shot(`biblio-${lib}`, 'liste');
    await au.step(`${lib}-ajouter`, async () => {
      await page
        .getByRole('link', { name: add })
        .or(page.getByRole('button', { name: add }))
        .first()
        .click();
      await page.waitForTimeout(800);
      au.note(`${lib}:formulaire`, await page.locator('main label, main legend').allInnerTexts());
      await au.shot(`fiche-${lib}`, 'nouveau');
      await au.check(`fiche-${lib}-nouveau`);
      // enregistrer sans rien remplir / avec un nom vide
      const name = page.getByLabel('Nom', { exact: true }).first();
      if (await name.count()) await name.fill('');
      const save = page
        .locator('main')
        .getByRole('button', { name: /^Ajouter|^Enregistrer/ })
        .last();
      au.note(`${lib}:enregistrer-vide-actif`, await save.isEnabled().catch(() => null));
      await save.click().catch(() => undefined);
      await page.waitForTimeout(500);
      au.note(`${lib}:apres-enregistrer-vide`, {
        url: page.url().replace(/^.*#/, '#'),
        messages: await page.locator('[role=alert], [aria-invalid=true]').count(),
      });
    });
  }
});

test('J6 supprimer un produit utilisé par un projet', async ({ page, au }) => {
  await seed(page, 'maison', '/#/library/tiles');
  const res: Record<string, unknown> = {};
  for (const [lib, id, del] of [
    ['tiles', 'modele-metro-20x10', 'Supprimer le carreau'],
    ['boards', 'modele-stratifie', 'Supprimer la lame'],
    ['systems', 'modele-72-48', 'Supprimer le système'],
  ] as const) {
    await page.goto(`/#/library/${lib}/${id}`);
    await page.waitForTimeout(800);
    await au.step(`${lib}-supprimer`, async () => {
      await page.getByRole('button', { name: del }).click();
      await page.waitForTimeout(400);
      res[lib] = await page
        .getByRole('dialog')
        .innerText()
        .catch(() => 'aucune fenêtre');
      await au.shot(`fiche-${lib}`, 'utilise');
      await page.keyboard.press('Escape');
    });
  }
  au.note('utilise', res);
  // modifier un produit utilisé : le projet suit-il ? (largeur du carreau)
  await page.goto('/#/library/tiles/modele-metro-20x10');
  await page.waitForTimeout(800);
  au.note('fiche-utilisee', (await page.locator('main').innerText()).slice(0, 800));
});

test('J7 coller une fiche produit, #/import', async ({ page, au }) => {
  await seed(page, 'maison', '/#/library/tiles/new');
  const sheet =
    'Caractéristiques techniques\nLongueur (en cm)\t60\nLargeur (en cm)\t60\nÉpaisseur (en mm)\t9\nNombre de carreaux par boîte\t4\nSurface couverte par boîte (en m²)\t1,44\nCouleur\tGris\nNom du produit\tCarrelage sol Grès Test 60 x 60 cm';
  await au.step('coller', async () => {
    await page.getByRole('button', { name: /Coller une fiche/ }).click();
    await page.waitForTimeout(400);
    await au.shot('fiche-carreau-nouveau', 'coller');
    const area = page.getByRole('dialog').getByRole('textbox').first();
    await area.fill(sheet);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Lire|Remplir|Utiliser|Appliquer/ })
      .first()
      .click();
    await page.waitForTimeout(600);
    au.note('apres-coller', (await page.locator('main').innerText()).slice(0, 1500));
    await au.shot('fiche-carreau-nouveau', 'apres-coller');
  });
  await page.goto('/#/import/' + encodeURIComponent(sheet));
  await page.waitForTimeout(1500);
  au.note('import', (await page.locator('main').innerText()).slice(0, 800));
  await au.shot('importer', 'fiche');
  await au.check('importer');
});
