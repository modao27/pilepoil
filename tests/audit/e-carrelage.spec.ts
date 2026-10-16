/** E. Carrelage : étapes du calepinage, motifs, optimisation, vues, résultats chiffrés, comparaison, PDF. */
import { statSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { cover, createProject, openPose, openRoom } from '../e2e/helpers';
import { maison, openSheet, panel, pdfText, seed, test, timed, typeIn } from './audit';

const solSdb = () => `/#/p/${maison().id}/m/carrelage/s/${maison().poses[4]!.id}`;
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

/** Contrôles visibles du panneau : libellés et nombre. */
async function controls(page: Page) {
  return panel(page)
    .locator('label, legend, h3, button')
    .evaluateAll((els) => [
      ...new Set(
        els
          .map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50))
          .filter(Boolean),
      ),
    ]);
}

test('E1 étape Produit : carreau, joint, couleurs', async ({ page, au }) => {
  await seed(page, 'maison', solSdb());
  await stepTab(page, 'Produit');
  au.note('controles', await controls(page));
  au.note('carreaux-proposes', await panel(page).getByRole('radiogroup').first().getByRole('radio').count());
  au.note('carreau-choisi', await panel(page).getByRole('radio', { checked: true }).first().innerText());
  au.note(
    'hauteur-liste',
    await panel(page)
      .getByRole('radiogroup')
      .first()
      .evaluate((el) => el.scrollHeight),
  );
  await au.shot('calepinage-carrelage', 'produit');
  await au.check('calepinage-produit');
  // un carreau de sol 60 × 60
  const before = await summary(page);
  const t = await timed(async () => {
    await panel(page)
      .getByRole('radio', { name: /60 × 60/ })
      .first()
      .click();
    await page
      .waitForFunction((b) => document.querySelector('a.summary')?.textContent !== b, before, { timeout: 15_000 })
      .catch(() => undefined);
  });
  au.note('changer-carreau', { avant: before, apres: await summary(page), ms: t });
  for (const v of ['0', '2', '20', '-1', '1,5'])
    au.note(`joint-${v}`, await typeIn(panel(page), 'Joint', v).catch(() => 'absent'));
  await au.shot('calepinage-carrelage', 'produit-60x60');
  await au.step('nouveau-carreau', async () => {
    await panel(page).getByRole('button', { name: 'Nouveau carreau' }).click();
    await page.waitForTimeout(500);
    au.note('nouveau-carreau', {
      url: page.url().replace(/^.*#/, '#'),
      fenetre: await page.getByRole('dialog').count(),
    });
    await au.shot('calepinage-carrelage', 'nouveau-carreau');
  });
});

test('E2 chaque motif, orientation, départ, décalage', async ({ page, au }) => {
  await seed(page, 'maison', solSdb());
  await stepTab(page, 'Pose');
  au.note('controles', await controls(page));
  const motifs = panel(page).getByRole('radiogroup', { name: 'Motif de pose' }).getByRole('radio');
  const n = await motifs.count();
  const res: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) {
    const r = motifs.nth(i);
    const name = (await r.innerText()).trim();
    const disabled = await r.isDisabled();
    if (disabled) {
      res[name] = 'grisé';
      continue;
    }
    const before = await summary(page);
    const ms = await timed(async () => {
      await r.click();
      await page
        .waitForFunction((b) => document.querySelector('a.summary')?.textContent !== b, before, { timeout: 10_000 })
        .catch(() => undefined);
    });
    res[name] = { resume: await summary(page), ms };
    await au.shot('calepinage-carrelage', `motif-${i}`, { full: false });
  }
  au.note('motifs', res);
  for (const label of ['Orientation du motif', 'Départ du motif'])
    au.note(
      label,
      await panel(page)
        .getByRole('radiogroup', { name: label })
        .getByRole('radio')
        .allInnerTexts()
        .catch(() => 'absent'),
    );
  for (const v of ['0', '50', '100', '150'])
    au.note(`decalage-${v}`, await typeIn(panel(page), 'Décalage horizontal', v).catch(() => 'absent'));
  // prix en vannerie : la ligne d'achat du carreau suit-elle le nombre de carreaux ?
  await au.step('vannerie-achats', async () => {
    await panel(page)
      .getByRole('radiogroup', { name: 'Motif de pose' })
      .getByRole('radio', { name: 'Vannerie' })
      .click();
    await page.waitForTimeout(2500);
    const resume = await summary(page);
    await page.goto(`/#/p/${maison().id}/achats`);
    await page.waitForTimeout(2500);
    const lines = (await page.locator('main').innerText()).split('\n').slice(0, 12);
    au.note('vannerie', { resume, achats: lines });
    await au.shot('achats', 'vannerie', { full: false });
    await page.goto(`/#/p/${maison().id}/pose/${maison().poses[4]!.id}/resultats`);
    await page.waitForTimeout(2500);
    await page.getByRole('tab', { name: 'Détail' }).click();
    au.note('vannerie-detail', (await page.locator('main').innerText()).slice(0, 1200));
  });
});

test('E3 optimiser le départ : progression, arrêt, gain', async ({ page, au }) => {
  await seed(page, 'maison', solSdb());
  const before = await summary(page);
  const btn = page.getByRole('button', { name: /^Optimiser/ }).first();
  au.note('bouton', await btn.getAttribute('aria-label'));
  const t0 = Date.now();
  await btn.click();
  await page.waitForTimeout(200);
  au.note('pendant', {
    boutons: await page.getByRole('button', { name: /Arrêter|Optimis/ }).allInnerTexts(),
    progression: await page.getByRole('progressbar').count(),
    statut: await page.getByRole('status').allInnerTexts(),
  });
  await au.shot('calepinage-carrelage', 'optimisation');
  await page
    .waitForFunction(() => !document.querySelector('[role=progressbar]'), null, { timeout: 60_000 })
    .catch(() => undefined);
  au.note('optimisation', {
    ms: Date.now() - t0,
    avant: before,
    apres: await summary(page),
    messages: await page.getByRole('status').allInnerTexts(),
  });
  await au.shot('calepinage-carrelage', 'optimise');
  // annuler l'optimisation revient-il au départ ?
  await page.getByRole('button', { name: 'Annuler', exact: true }).first().click();
  await page.waitForTimeout(800);
  au.note('apres-annuler', await summary(page));
});

test('E4 Découpage : bandes, réservations, ouvertures', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/m/carrelage/s/${maison().poses[5]!.id}`);
  await stepTab(page, 'Découpage');
  au.note('controles', await controls(page));
  await au.shot('calepinage-carrelage-murs', 'decoupage');
  await au.check('calepinage-decoupage');
  await au.step('bande', async () => {
    await panel(page).getByRole('button', { name: 'Ajouter une bande' }).click();
    await page.waitForTimeout(500);
    au.note('apres-bande', await controls(page));
    await au.shot('calepinage-carrelage-murs', 'bande');
  });
  await au.step('frise', async () => {
    await panel(page)
      .getByRole('button', { name: /^Frise/ })
      .click();
    await page.waitForTimeout(800);
    au.note('apres-frise', await summary(page));
    await au.shot('calepinage-carrelage-murs', 'frise');
  });
  await au.step('reservation', async () => {
    const add = panel(page).getByRole('button', { name: 'Ajouter', exact: true }).first();
    au.note(
      'types',
      await panel(page)
        .getByLabel('Type à ajouter')
        .locator('option')
        .allInnerTexts()
        .catch(() => []),
    );
    await add.click();
    await page.waitForTimeout(500);
    for (const [l, v] of [
      ['Largeur', '5000'],
      ['Depuis le bord gauche', '-20'],
    ] as const)
      au.note(`reservation-${l}`, await typeIn(panel(page), l, v).catch(() => 'absent'));
    await au.shot('calepinage-carrelage-murs', 'reservation');
  });
});

test('E5 Finitions et Avancé', async ({ page, au }) => {
  await seed(page, 'maison', solSdb());
  for (const s of ['Finitions', 'Avancé']) {
    await stepTab(page, s);
    au.note(`${s}:controles`, await controls(page));
    await au.shot('calepinage-carrelage', s === 'Avancé' ? 'avance' : 'finitions');
  }
  for (const [l, v] of [
    ['Perte par coupe', '-5'],
    ['Perte par coupe', '50'],
    ['Chute minimale gardée', '0'],
    ['Marge de casse', '100'],
  ] as const)
    au.note(`${l}=${v}`, {
      affiche: await typeIn(panel(page), l, v).catch(() => 'absent'),
      resume: await summary(page),
    });
});

test('E6 vues Plan, Rendu, 3D ; zoom', async ({ page, au }) => {
  await seed(page, 'maison', solSdb());
  for (const v of ['Rendu', '3D', 'Plan']) {
    const ms = await timed(async () => {
      await page.getByRole('radio', { name: v, exact: true }).first().click();
      await page.waitForTimeout(v === '3D' ? 2500 : 600);
    });
    au.note(`vue-${v}`, ms);
    await au.shot('calepinage-carrelage', `vue-${v}`, { full: false });
  }
  await au.step('3d-piece', async () => {
    await page.getByRole('radio', { name: '3D', exact: true }).first().click();
    await page.getByRole('radio', { name: 'Pièce', exact: true }).click();
    await page.waitForTimeout(2500);
    await au.shot('calepinage-carrelage', 'vue-3D-piece', { full: false });
  });
  // le dessin du plan : nom accessible, alternative textuelle
  au.note(
    'plan-accessible',
    await page
      .getByRole('application')
      .first()
      .getAttribute('aria-label')
      .catch(() => null),
  );
});

test('E7 quantités vérifiables à la main : sol 300 × 240, grès 60 × 60', async ({ page, au }) => {
  const id = await createProject(page, { project: 'E7', name: 'Cuisine', size: [300, 240] });
  await openRoom(page, id, 'Cuisine');
  await cover(page, 'Sol', 'carrelage');
  await openPose(page, 'Sol');
  await page.waitForTimeout(1500);
  await stepTab(page, 'Produit');
  await panel(page)
    .getByRole('radio', { name: /Grès.*60 × 60|60 × 60/ })
    .first()
    .click();
  await page.waitForTimeout(1500);
  au.note('carreau', await panel(page).getByRole('radio', { checked: true }).first().innerText());
  au.note(
    'joint',
    await panel(page)
      .getByLabel('Joint', { exact: true })
      .inputValue()
      .catch(() => '?'),
  );
  au.note('resume', await summary(page));
  await au.shot('calepinage-carrelage', 'E7-sol');
  // résultats de la pose : tout le texte
  await page.locator('a.summary').first().click();
  await page.waitForTimeout(2500);
  au.note('resultats', (await page.locator('main').innerText()).slice(0, 3000));
  await au.shot('resultats-pose', 'E7');
  await page.getByRole('tab', { name: 'Détail' }).click();
  await page.waitForTimeout(800);
  au.note('detail', (await page.locator('main').innerText()).slice(0, 4000));
  await au.shot('resultats-pose', 'E7-detail');
  await page.goto(`/#/p/${id}/achats`);
  await page.waitForTimeout(2000);
  au.note('achats', (await page.locator('main').innerText()).slice(0, 2500));
});

test('E8 Comparer A/B', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/m/carrelage/compare`);
  await page.waitForTimeout(1500);
  au.note('ecran', (await page.locator('main').innerText()).slice(0, 1200));
  au.note(
    'acces-depuis',
    'aucun lien vers #/…/compare trouvé dans la vue globale ni le calepinage ? (relevé ci-dessous)',
  );
  await au.shot('comparer', 'vide');
  await au.step('enregistrer-a', async () => {
    await page.getByRole('button', { name: 'Enregistrer l’état actuel' }).first().click();
    await page.waitForTimeout(800);
    await au.shot('comparer', 'a');
  });
  // existe-t-il un chemin vers Comparer ?
  await page.goto(solSdb());
  await page.waitForTimeout(1500);
  const links = await page.locator('a[href*="compare"]').count();
  await page.goto(`/#/p/${maison().id}`);
  await page.waitForTimeout(1500);
  au.note('liens-vers-comparer', { calepinage: links, projet: await page.locator('a[href*="compare"]').count() });
});

test('E9 murs qui se suivent et sols reliés : continuité', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/m/carrelage/s/${maison().poses[5]!.id}`);
  await page.waitForTimeout(1500);
  au.note(
    'titre',
    await page
      .locator('header .title')
      .innerText()
      .catch(() => ''),
  );
  au.note('resume', await summary(page));
  await au.shot('calepinage-carrelage-murs', 'angle');
  await page.getByRole('radio', { name: '3D', exact: true }).first().click();
  await page.waitForTimeout(2500);
  await au.shot('calepinage-carrelage-murs', 'angle-3d', { full: false });
  // liste des poses (titre)
  await au.step('liste-poses', async () => {
    await page.locator('header .title').click();
    await page.waitForTimeout(400);
    au.note('liste-poses', await page.getByRole('dialog').innerText());
    await au.shot('calepinage-carrelage-murs', 'liste-poses');
  });
});

test('E10 PDF du calepinage : ouvert et lu', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/pose/${maison().poses[4]!.id}/resultats`);
  await page.waitForTimeout(2500);
  const btns = await page.getByRole('button', { name: /PDF/ }).allInnerTexts();
  au.note('boutons', btns);
  await au.step('pdf', async () => {
    const t0 = Date.now();
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /PDF/ }).first().click(),
    ]);
    const path = await d.path();
    au.note('pdf', {
      nom: d.suggestedFilename(),
      octets: statSync(path).size,
      ms: Date.now() - t0,
      message: await page.getByRole('status').allInnerTexts(),
    });
    au.note('pdf-texte', await pdfText(path, 1500));
  });
});
