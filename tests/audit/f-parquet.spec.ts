/** F. Parquet : motifs, angle, règles, alertes, optimisation, deux pièces, chiffres, PDF. */
import { statSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { cover, createProject, fillNumber, openRoom } from '../e2e/helpers';
import { maison, openSheet, panel, pdfText, seed, test, timed, typeIn } from './audit';

const pose = () => `/#/p/${maison().id}/m/parquet/pose/${maison().poses[0]!.id}`;
const summary = (page: Page) =>
  page
    .locator('a.summary')
    .first()
    .innerText()
    .catch(() => '');
const alerts = (page: Page) =>
  page
    .getByRole('region', { name: /Alertes/ })
    .or(page.locator('[aria-label="Alertes"]'))
    .first()
    .innerText()
    .catch(() => '');

async function stepTab(page: Page, name: string) {
  await openSheet(page);
  await panel(page).getByRole('tab', { name, exact: true }).click();
  await page.waitForTimeout(300);
}

async function waitChange(page: Page, before: string) {
  await page
    .waitForFunction(
      (b) => {
        const t = document.querySelector('a.summary')?.textContent ?? '';
        return t !== b && !t.includes('Calcul');
      },
      before,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
}

test('F1 chaque motif, décalage, angle', async ({ page, au }) => {
  await seed(page, 'maison', pose());
  await page.waitForTimeout(1500);
  await stepTab(page, 'Pose');
  au.note('controles', await panel(page).locator('label, legend, h2, h3').allInnerTexts());
  const res: Record<string, unknown> = {};
  const motif = panel(page).getByRole('radiogroup', { name: 'Motif' });
  for (const m of await motif.getByRole('radio').allInnerTexts()) {
    const before = await summary(page);
    const ms = await timed(async () => {
      await motif.getByRole('radio', { name: m }).click();
      await waitChange(page, before);
    });
    res[m] = { resume: await summary(page), ms, alertes: await alerts(page) };
    await au.shot('calepinage-parquet', `motif-${m.replace(/\W+/g, '')}`, { full: false });
    if (m === 'Hongrie') {
      await panel(page)
        .getByRole('radio', { name: '60°' })
        .click()
        .catch(() => undefined);
      await page.waitForTimeout(1500);
      res['Hongrie 60°'] = { resume: await summary(page), alertes: await alerts(page) };
      await au.shot('calepinage-parquet', 'hongrie-60', { full: false });
    }
  }
  await motif.getByRole('radio', { name: 'Droite' }).click();
  for (const s of await panel(page)
    .getByRole('radiogroup', { name: 'Décalage des rangs' })
    .getByRole('radio')
    .allInnerTexts()
    .catch(() => [] as string[])) {
    const before = await summary(page);
    await panel(page).getByRole('radiogroup', { name: 'Décalage des rangs' }).getByRole('radio', { name: s }).click();
    await waitChange(page, before);
    res[`décalage ${s}`] = await summary(page);
  }
  for (const a of ['0', '45', '90', '180', '-10', '30,5']) {
    const shown = await typeIn(panel(page), /^Angle des lames|^Angle du motif/, a).catch(() => 'absent');
    await page.waitForTimeout(1200);
    res[`angle ${a}`] = { affiche: shown, resume: await summary(page) };
  }
  await au.shot('calepinage-parquet', 'angle');
  au.note('motifs', res);
});

test('F2 axe, mur de référence, règles de pose', async ({ page, au }) => {
  await seed(page, 'maison', pose());
  await page.waitForTimeout(1500);
  for (const s of ['Pose', 'Découpage', 'Finitions', 'Avancé']) {
    await stepTab(page, s);
    au.note(
      `${s}:controles`,
      await panel(page)
        .locator('label, legend, h2, h3, button')
        .evaluateAll((els) => [
          ...new Set(
            els.map((e) =>
              (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50),
            ),
          ),
        ]),
    );
    await au.shot('calepinage-parquet', `etape-${s}`);
  }
  au.note('axe-ou-reference', await page.getByText(/axe|référence|départ/i).allInnerTexts());
  await stepTab(page, 'Avancé');
  const res: Record<string, unknown> = {};
  for (const [l, v] of [
    ['Jeu périphérique', '0'],
    ['Jeu périphérique', '50'],
    ['Coupe mini en bout', '0'],
    ['Coupe mini en bout', '2000'],
    ['Rang de bord mini', '500'],
    ['Décalage mini des joints', '1000'],
  ] as const) {
    const shown = await typeIn(panel(page), l, v).catch(() => 'absent');
    await page.waitForTimeout(1200);
    res[`${l}=${v}`] = { affiche: shown, resume: await summary(page), alertes: await alerts(page) };
  }
  au.note('regles', res);
  await au.shot('calepinage-parquet', 'regles-extremes');
});

test('F3 alertes : textes et actions proposées', async ({ page, au }) => {
  await seed(page, 'maison', pose());
  await page.waitForTimeout(1500);
  await stepTab(page, 'Pose');
  await panel(page).getByRole('radiogroup', { name: 'Motif' }).getByRole('radio', { name: 'Bâton rompu' }).click();
  await page.waitForTimeout(2500);
  au.note('baton-rompu-stratifie', {
    alertes: await alerts(page),
    avertissement: await panel(page)
      .getByText(/lames A et B/)
      .allInnerTexts(),
  });
  await au.shot('calepinage-parquet', 'alertes');
  au.note(
    'boutons-dans-alertes',
    await page
      .locator('[aria-label="Alertes"] button, [aria-label="Alertes"] a')
      .allInnerTexts()
      .catch(() => []),
  );
  await au.check('calepinage-parquet-alertes');
});

test('F4 optimisation : durée, arrêt, gain', async ({ page, au }) => {
  await seed(page, 'maison', pose());
  await page.waitForTimeout(1500);
  const before = await summary(page);
  const btn = page.getByRole('button', { name: /Optimiser/ }).first();
  au.note('present', await btn.count());
  if (!(await btn.count())) return;
  const t0 = Date.now();
  await btn.click();
  await page.waitForTimeout(150);
  au.note('pendant', {
    boutons: await page.getByRole('button', { name: /Arrêter|Optimis/ }).allInnerTexts(),
    progression: await page.getByRole('progressbar').count(),
  });
  await au.shot('calepinage-parquet', 'optimisation');
  await page
    .waitForFunction(() => !document.querySelector('[role=progressbar]'), null, { timeout: 60_000 })
    .catch(() => undefined);
  au.note('resultat', { ms: Date.now() - t0, avant: before, apres: await summary(page) });
});

test('F5 deux pièces reliées, seuils, séparer', async ({ page, au }) => {
  const id = await createProject(page, { project: 'F5', name: 'Entrée', size: [200, 300] });
  await page.getByRole('banner').getByRole('button', { name: 'Ajouter une pièce' }).click();
  const add = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await add.getByLabel('Nom', { exact: true }).fill('Séjour');
  await add.getByLabel('Emplacement').selectOption({ index: 2 });
  await add.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await au.step('porte', () =>
    panel(page)
      .getByRole('button', { name: /^Porte vers/ })
      .first()
      .click(),
  );
  await page.waitForTimeout(800);
  await openRoom(page, id, 'Entrée');
  await cover(page, 'Sol', 'parquet');
  await openRoom(page, id, 'Séjour');
  await au.step('continuer', () => cover(page, 'Sol', 'parquet', 'continue'));
  await page.getByRole('link', { name: 'Calepinage' }).first().click();
  await page.waitForTimeout(2500);
  await au.shot('calepinage-parquet', 'deux-pieces', { full: false });
  au.note('resume', await summary(page));
  await stepTab(page, 'Découpage');
  au.note('decoupage', (await panel(page).innerText()).slice(0, 1200));
  await au.shot('calepinage-parquet', 'seuils');
  await au.step('poser-seuil', async () => {
    await panel(page).getByRole('button', { name: 'Poser ce seuil' }).first().click();
    await page.waitForTimeout(1500);
    au.note('apres-seuil', { resume: await summary(page), panneau: (await panel(page).innerText()).slice(0, 800) });
  });
  await au.step('separer', async () => {
    await panel(page).getByRole('button', { name: 'Séparer en deux poses' }).first().click();
    await page.waitForTimeout(1500);
    au.note('apres-separer', { url: page.url().replace(/^.*#/, '#'), resume: await summary(page) });
  });
  void fillNumber;
});

test('F6 chiffres du parquet du séjour : résultats et achats', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/pose/${maison().poses[0]!.id}/resultats`);
  await page.waitForTimeout(2500);
  au.note('resume', (await page.locator('main').innerText()).slice(0, 3000));
  await page.getByRole('tab', { name: 'Détail' }).click();
  await page.waitForTimeout(800);
  au.note('detail', (await page.locator('main').innerText()).slice(0, 5000));
  await au.shot('resultats-pose', 'parquet-detail');
  await page.goto(pose());
  await page.waitForTimeout(1500);
  for (const s of ['Produit', 'Avancé']) {
    await stepTab(page, s);
    au.note(
      `reglages-${s}`,
      await panel(page)
        .locator('input, select')
        .evaluateAll((is) => is.map((i) => `${i.getAttribute('aria-label') ?? i.id}=${(i as HTMLInputElement).value}`)),
    );
  }
  await page.goto('/#/library/boards');
  await page.waitForTimeout(800);
});

test('F7 PDF du parquet', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/pose/${maison().poses[0]!.id}/resultats`);
  await page.waitForTimeout(2500);
  await au.step('pdf', async () => {
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /PDF/ }).first().click(),
    ]);
    const path = await d.path();
    au.note('pdf', { nom: d.suggestedFilename(), octets: statSync(path).size });
    au.note('pdf-texte', await pdfText(path, 2500));
  });
});
