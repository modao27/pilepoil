/** C. Plan commun : formes, cotes, dessin, erreurs, ouvertures, obstacles, pièces reliées, gestes, annuler. */
import type { Page } from '@playwright/test';
import { createProject } from '../e2e/helpers';
import { maison, panel, seed, tap, test, typeIn } from './audit';

const roomBtn = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true });

/** Texte des étiquettes du plan (noms, surfaces, cotes). */
const planText = (page: Page) =>
  page
    .getByRole('application')
    .first()
    .locator('text')
    .allTextContents()
    .then((t) => t.map((x) => x.trim()).filter(Boolean));

/** Messages visibles : alertes, statut, problèmes. */
async function messages(page: Page): Promise<string[]> {
  const t = await page.locator('[role=alert], [role=status], .errors, [aria-invalid=true]').allInnerTexts();
  return t.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

test('C1 rectangle, L, U : cotes et surfaces affichées', async ({ page, au }) => {
  await createProject(page, {
    project: 'C1',
    name: 'Salon',
    size: [500, 400],
    shape: 'En L',
    more: { 'Retrait en longueur': '200', 'Retrait en largeur': '150' },
  });
  await page.waitForTimeout(500);
  au.note('L-etiquettes', await planText(page));
  await au.shot('plan', 'L');
  await roomBtn(page, 'Salon')
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(300);
  await au.shot('plan', 'L-selection');
  au.note(
    'L-murs',
    await panel(page)
      .getByRole('textbox', { name: /^Mur \d/ })
      .evaluateAll((is) => is.map((i) => `${i.getAttribute('aria-label')}=${(i as HTMLInputElement).value}`)),
  );
  await au.check('plan-L');
});

test('C2 saisie des cotes : expressions, virgule, unités, collage', async ({ page, au }) => {
  await createProject(page, { project: 'C2', name: 'Pièce', size: [400, 300] });
  await roomBtn(page, 'Pièce')
    .click()
    .catch(() => undefined);
  const inputs = [
    '240+60',
    '2,4',
    '2.4',
    '2,4 m',
    '240 cm',
    '240-12',
    '2 × 150',
    '(100+50)*2',
    '',
    '   ',
    'abc',
    '3e2',
    '1/0',
    '-50',
    '0',
    '0,1',
    '10000',
    '300,555',
    '1 200',
  ];
  const res: Record<string, unknown> = {};
  for (const v of inputs) {
    const shown = await typeIn(panel(page), 'Mur 1', v);
    res[JSON.stringify(v)] = {
      affiche: shown,
      messages: await messages(page),
      invalide: await panel(page).getByLabel('Mur 1', { exact: true }).getAttribute('aria-invalid'),
    };
    if (['abc', '-50', '0', '10000'].includes(v)) await au.shot('plan', `saisie-${v}`);
    await typeIn(panel(page), 'Mur 1', '400');
  }
  au.note('mur-1', res);
  // boutons +/− : pas d'un appui
  const f = panel(page).getByLabel('Mur 1', { exact: true });
  const before = await f.inputValue();
  await au.step('plus', () => panel(page).getByRole('button', { name: 'Augmenter Mur 1' }).click());
  au.note('pas-plus', { avant: before, apres: await f.inputValue() });
  // collage du presse-papiers (texte avec unité et espace insécable)
  await f.fill('');
  await f.evaluate((el: HTMLInputElement) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '3 50 cm');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await f.press('Enter');
  au.note('colle', await f.inputValue());
  // clavier proposé sur téléphone
  au.note('inputmode', await f.getAttribute('inputmode'));
  au.note('type', await f.getAttribute('type'));
});

test('C3 dessin libre : poser, retirer, terminer', async ({ page, au }) => {
  await page.goto('/#/new');
  const d = page.getByRole('dialog', { name: 'Nouveau projet' });
  await d.getByRole('radio', { name: 'Dessin' }).click();
  await d.getByRole('button', { name: 'Commencer le dessin' }).click();
  const b = (await page.getByRole('application').first().boundingBox())!;
  au.note(
    'terminer-actif-0',
    await panel(page)
      .getByRole('button', { name: 'Terminer la pièce' })
      .isEnabled()
      .catch(() => null),
  );
  for (const [x, y] of [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.75, 0.7],
    [0.5, 0.7],
    [0.5, 0.5],
    [0.25, 0.5],
  ] as const) {
    await tap(page, b.x + b.width * x, b.y + b.height * y, au.isTouch);
    await page.waitForTimeout(200);
  }
  await au.shot('plan', 'dessin-6-points');
  await au.step('retirer', () => panel(page).getByRole('button', { name: 'Retirer le dernier point' }).click());
  au.note(
    'compteur',
    await panel(page)
      .getByText(/\d+ points?/)
      .innerText()
      .catch(() => ''),
  );
  await tap(page, b.x + b.width * 0.25, b.y + b.height * 0.5, au.isTouch);
  await au.step('terminer', () => panel(page).getByRole('button', { name: 'Terminer la pièce' }).click());
  const naming = page.getByRole('dialog', { name: 'Nommer la pièce' });
  au.note('fenetre-nom', await naming.isVisible());
  await au.shot('plan', 'nommer');
  await au.step('creer', async () => {
    await naming.getByLabel('Nom de la pièce').fill('Cuisine');
    await naming.getByRole('button', { name: 'Créer la pièce' }).click();
    await page.waitForTimeout(800);
  });
  au.note('etiquettes', await planText(page));
  await au.shot('plan', 'dessin-cree');
});

test('C4 erreurs de contour : croisé, moins de 3 points, aire nulle', async ({ page, au }) => {
  const draw = async (pts: [number, number][], label: string) => {
    await page.goto('/#/new');
    await page.reload();
    const d = page.getByRole('dialog', { name: 'Nouveau projet' });
    await d.getByRole('radio', { name: 'Dessin' }).click();
    await d.getByRole('button', { name: 'Commencer le dessin' }).click();
    const b = (await page.getByRole('application').first().boundingBox())!;
    for (const [x, y] of pts) {
      await tap(page, b.x + b.width * x, b.y + b.height * y, au.isTouch);
      await page.waitForTimeout(200);
    }
    const term = panel(page).getByRole('button', { name: 'Terminer la pièce' });
    const enabled = await term.isEnabled().catch(() => null);
    if (enabled) await term.click();
    await page.waitForTimeout(400);
    au.note(label, {
      terminerActif: enabled,
      messages: await messages(page),
      fenetreNom: await page.getByRole('dialog', { name: 'Nommer la pièce' }).isVisible(),
    });
    await au.shot('plan', label);
  };
  await draw(
    [
      [0.25, 0.25],
      [0.75, 0.65],
      [0.75, 0.25],
      [0.25, 0.65],
    ],
    'croise',
  );
  await draw(
    [
      [0.25, 0.25],
      [0.75, 0.25],
    ],
    'deux-points',
  );
  await draw(
    [
      [0.2, 0.4],
      [0.5, 0.4],
      [0.8, 0.4],
    ],
    'aire-nulle',
  );
  // rectangle de 0 cm par la fenêtre
  await page.goto('/#/new');
  await page.reload();
  const d = page.getByRole('dialog', { name: 'Nouveau projet' });
  for (const v of ['0', '-100', '5', '100000']) {
    await typeIn(d, 'Largeur', v);
    au.note(`largeur-${v}`, {
      affiche: await d.getByLabel('Largeur', { exact: true }).inputValue(),
      ajouter: await d.getByRole('button', { name: 'Ajouter', exact: true }).isEnabled(),
      messages: await messages(page),
    });
  }
  await au.shot('nouveau-projet', 'largeur-limite');
});

test('C5 obstacle : ajout, taille hors pièce', async ({ page, au }) => {
  await createProject(page, { project: 'C5', name: 'Pièce', size: [300, 250] });
  await roomBtn(page, 'Pièce')
    .click()
    .catch(() => undefined);
  await au.step('ajouter', () => panel(page).getByRole('button', { name: 'Ajouter un obstacle' }).click());
  await page.waitForTimeout(400);
  await au.shot('plan', 'obstacle');
  au.note('champs', await panel(page).locator('label, legend').allInnerTexts());
  for (const v of ['1000', '0']) {
    const shown = await typeIn(panel(page), 'Largeur', v).catch(() => 'absent');
    au.note(`largeur-${v}`, { affiche: shown, messages: await messages(page) });
    await au.shot('plan', `obstacle-${v}`);
  }
  au.note(
    'position-reglable',
    await panel(page)
      .getByLabel(/Distance|Position|X|Depuis/)
      .count(),
  );
  // glisser l'obstacle hors de la pièce
  await au.step('glisser-hors', async () => {
    const o = page.locator('[data-k="obstacle"], .obstacle').first();
    const ob = (await o.boundingBox())!;
    await page.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2);
    await page.mouse.down();
    await page.mouse.move(ob.x + 600, ob.y + 400, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    au.note('apres-glisser', await messages(page));
    await au.shot('plan', 'obstacle-hors');
  });
});

test('C6 portes, fenêtres, baies : valeurs hors mur', async ({ page, au }) => {
  await createProject(page, { project: 'C6', name: 'Pièce', size: [300, 250] });
  await roomBtn(page, 'Pièce')
    .click()
    .catch(() => undefined);
  await panel(page)
    .getByRole('button', { name: /^Ouvertures et épaisseur/ })
    .first()
    .click();
  for (const kind of ['Ajouter une porte', 'Ajouter une fenêtre', 'Ajouter une baie']) {
    await au.step(kind, async () => {
      await panel(page).getByRole('button', { name: kind }).click();
      await page.waitForTimeout(300);
      au.note(
        `${kind}:valeurs`,
        await panel(page)
          .locator('input')
          .evaluateAll((is) => is.map((i) => `${i.getAttribute('aria-label') ?? ''}=${(i as HTMLInputElement).value}`)),
      );
      await au.shot('plan', kind.replace('Ajouter une ', 'ouverture-'));
      // revenir au mur 1
      await panel(page)
        .getByRole('button', { name: /^Retour à/ })
        .first()
        .click()
        .catch(() => undefined);
      await panel(page)
        .getByRole('button', { name: /^Ouvertures et épaisseur/ })
        .first()
        .click();
    });
  }
  // une porte trop large et trop loin
  await au.step('porte-hors-mur', async () => {
    await page.getByRole('application').first().locator('[data-k="opening"]').first().click({ force: true });
    for (const [label, v] of [
      ['Largeur', '900'],
      ['Distance au début du mur', '800'],
      ['Hauteur', '400'],
    ] as const) {
      const shown = await typeIn(panel(page), label, v);
      au.note(`porte:${label}=${v}`, { affiche: shown, messages: await messages(page) });
    }
    await au.shot('plan', 'porte-hors-mur');
  });
  au.note(
    'a-corriger',
    await page
      .getByRole('region', { name: /Problèmes/ })
      .allInnerTexts()
      .catch(() => []),
  );
});

test('C7 seconde pièce, portes reliées, passage', async ({ page, au }) => {
  await createProject(page, { project: 'C7', name: 'Entrée', size: [200, 300] });
  await page.getByRole('banner').getByRole('button', { name: 'Ajouter une pièce' }).click();
  const add = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await add.getByLabel('Nom', { exact: true }).fill('Couloir');
  au.note(
    'emplacements',
    await add
      .getByLabel('Emplacement')
      .locator('option')
      .allInnerTexts()
      .catch(() => []),
  );
  await au.step('contre', () => add.getByLabel('Emplacement').selectOption({ index: 2 }));
  await au.shot('plan', 'ajout-contre');
  await add.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForTimeout(500);
  await au.shot('plan', 'deux-pieces');
  au.note(
    'voisines',
    await panel(page)
      .getByRole('button', { name: /^Porte vers/ })
      .allInnerTexts(),
  );
  await au.step('porte-vers', async () => {
    await panel(page)
      .getByRole('button', { name: /^Porte vers/ })
      .first()
      .click();
    await page.waitForTimeout(500);
    au.note('apres-porte-vers', await panel(page).locator('h2').allInnerTexts());
    await au.shot('plan', 'porte-vers');
  });
  au.note('panneau-passage', (await panel(page).innerText()).slice(0, 500));
  // passage incohérent : on raccourcit le mur commun du couloir, puis on regarde « À corriger »
  await au.step('eloigner', async () => {
    await panel(page)
      .getByRole('button', { name: /^Toutes les pièces/ })
      .click();
    await roomBtn(page, 'Couloir').click();
    await typeIn(panel(page), 'Mur 1', '100');
    await page.waitForTimeout(400);
    au.note('apres-cote', await messages(page));
    await au.shot('plan', 'passage-cote-changee');
  });
  await au.step('supprimer-passage', async () => {
    await page.getByRole('application').first().locator('[data-k="passage"]').first().click({ force: true });
    await panel(page).getByRole('button', { name: 'Supprimer le passage' }).click();
    await page.waitForTimeout(400);
    au.note('apres-suppression-porte', await messages(page));
    await au.shot('plan', 'passage-sans-porte');
  });
});

test('C8 déplacer un coin, ajouter un point, aimantation', async ({ page, au }) => {
  await createProject(page, { project: 'C8', name: 'Pièce', size: [400, 300] });
  const app = page.getByRole('application').first();
  await roomBtn(page, 'Pièce')
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(300);
  const before = await planText(page);
  const handles = app.locator('[data-k="point"]');
  au.note('poignees', await handles.count());
  await au.step('glisser-coin', async () => {
    const h = (await handles.nth(2).boundingBox())!;
    const x = h.x + h.width / 2,
      y = h.y + h.height / 2;
    if (au.isTouch && au.engine === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 10; i++)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + i * 3.3, y: y + i * 2.1 }],
        });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 33, y + 21, { steps: 10 });
      await page.mouse.up();
    }
    await page.waitForTimeout(400);
    au.note('cotes', { avant: before, apres: await planText(page) });
    await au.shot('plan', 'coin-deplace');
  });
  await au.step('point-milieu', async () => {
    await panel(page)
      .getByRole('button', { name: /^Retour à/ })
      .first()
      .click();
    await panel(page)
      .getByRole('button', { name: /^Ouvertures et épaisseur/ })
      .first()
      .click();
    await panel(page).getByRole('button', { name: 'Ajouter un point au milieu' }).click();
    await page.waitForTimeout(300);
    au.note('apres-point', await planText(page));
    await au.shot('plan', 'point-milieu');
  });
  au.note(
    'poignee-taille',
    await handles
      .first()
      .evaluate((el) => JSON.stringify(el.getBoundingClientRect()))
      .catch(() => null),
  );
});

test('C9 zoom, déplacement, voir tout', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/plan`);
  const app = page.getByRole('application').first();
  await app.waitFor();
  const label = async () => app.locator('text').first().boundingBox();
  const b = (await app.boundingBox())!;
  const before = await label();
  if (au.isTouch && au.engine === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: cx - 20, y: cy, id: 1 },
        { x: cx + 20, y: cy, id: 2 },
      ],
    });
    for (let i = 1; i <= 10; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: cx - 20 - i * 8, y: cy, id: 1 },
          { x: cx + 20 + i * 8, y: cy, id: 2 },
        ],
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    au.note('pincer', { avant: before, apres: await label() });
  } else if (!au.isTouch) {
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(300);
    au.note('molette', { avant: before, apres: await label() });
  } else au.note('pincer', 'non testable (WebKit : pas de multi-touch dans Playwright)');
  await au.shot('plan', 'zoome');
  // glisser la vue
  await page.mouse.move(b.x + 40, b.y + 40);
  await page.mouse.down();
  await page.mouse.move(b.x + 140, b.y + 120, { steps: 8 });
  await page.mouse.up();
  au.note('glisser', await label());
  await page.getByRole('button', { name: 'Voir tout le plan' }).click();
  await page.waitForTimeout(300);
  au.note('voir-tout', await label());
  await au.shot('plan', 'voir-tout');
  // zoom au clavier ?
  await app.focus();
  await page.keyboard.press('+');
  au.note('clavier-plus', await label());
});

test('C10 panneau tiré : crans, clavier', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/plan`);
  await page.getByRole('application').first().waitFor();
  await page.waitForTimeout(800);
  const sheet = page.locator('.sheet');
  if (!(await sheet.count())) {
    au.note('panneau', 'inspecteur latéral (pas de panneau tiré)');
    await au.shot('plan', 'inspecteur');
    return;
  }
  const handle = sheet.getByRole('slider').or(sheet.locator('[role=button], button').first()).first();
  const box = async () => sheet.boundingBox();
  au.note('poignee', {
    role: await handle.getAttribute('role'),
    label: await handle.getAttribute('aria-label'),
    valeur: await handle.getAttribute('aria-valuetext'),
  });
  const states: unknown[] = [await box()];
  await handle.focus();
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(350);
    states.push({ k, box: await box() });
  }
  au.note('crans-clavier', states);
  await au.shot('plan', 'panneau-ferme');
  // glisser la poignée vers le haut
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, 80, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  au.note('glisse-haut', await box());
  await au.shot('plan', 'panneau-plein');
  await au.check('plan-panneau-plein');
});

test('C11 annuler / rétablir chaque action, puis après rechargement', async ({ page, au }) => {
  await createProject(page, { project: 'C11', name: 'Pièce', size: [400, 300] });
  const undo = page.getByRole('button', { name: 'Annuler', exact: true }).first();
  const redo = page.getByRole('button', { name: 'Rétablir' });
  await roomBtn(page, 'Pièce')
    .click()
    .catch(() => undefined);
  const steps: Record<string, unknown> = {};
  const act = async (label: string, run: () => Promise<unknown>) => {
    const before = await planText(page);
    const r = await au.step(label, async () => {
      await run();
      await page.waitForTimeout(300);
      const after = await planText(page);
      await undo.click();
      await page.waitForTimeout(300);
      const undone = await planText(page);
      await redo.click();
      await page.waitForTimeout(300);
      return {
        change: JSON.stringify(after) !== JSON.stringify(before),
        annule: JSON.stringify(undone) === JSON.stringify(before),
        retabli: JSON.stringify(await planText(page)) === JSON.stringify(after),
      };
    });
    steps[label] = r;
  };
  await act('cote-mur', () => typeIn(panel(page), 'Mur 1', '450'));
  await act('hauteur', () => typeIn(panel(page), 'Hauteur sous plafond', '270'));
  await act('nom', () => typeIn(panel(page), 'Nom de la pièce', 'Bureau'));
  await act('obstacle', () => panel(page).getByRole('button', { name: 'Ajouter un obstacle' }).click());
  au.note('actions', steps);
  // historique après rechargement
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('application').first().waitFor();
  au.note('apres-rechargement', { annulerActif: await undo.isEnabled(), retablirActif: await redo.isEnabled() });
  await au.shot('plan', 'apres-rechargement');
  // raccourcis clavier
  await typeIn(panel(page), 'Hauteur sous plafond', '280').catch(() => undefined);
  await page.getByRole('application').first().focus();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  au.note(
    'ctrl-z',
    await panel(page)
      .getByLabel('Hauteur sous plafond', { exact: true })
      .inputValue()
      .catch(() => 'n/a'),
  );
});

test('C12 supprimer une pièce revêtue (bouton, touche Suppr)', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/plan`);
  await roomBtn(page, 'Salle de bain').click();
  await panel(page).getByRole('button', { name: 'Supprimer la pièce' }).click();
  const d = page.getByRole('dialog');
  au.note('confirmation-bouton', await d.innerText().catch(() => 'aucune'));
  await au.shot('plan', 'confirmer-suppression');
  await au.check('plan-confirmer-suppression');
  await d
    .getByRole('button', { name: /Annuler|Garder/ })
    .first()
    .click()
    .catch(() => undefined);
  // touche Suppr sur la pièce sélectionnée
  await roomBtn(page, 'Salle de bain')
    .click()
    .catch(() => undefined);
  if (!au.isTouch) {
    await page.getByRole('application').first().focus();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);
    au.note('suppr', { fenetre: await page.getByRole('dialog').count(), pieces: await planText(page) });
    await au.shot('plan', 'apres-suppr');
  }
  // retour au projet : poses de la salle de bain ?
  await page.goto(`/#/p/${m.id}`);
  await page.waitForTimeout(1500);
  au.note('projet-apres', (await page.locator('main').innerText()).slice(0, 600));
});

test('C13 calque Travaux : verrou, cloison, démolition, surface perdue', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/plan`);
  await panel(page).getByRole('radio', { name: 'Travaux' }).click();
  await au.shot('plan', 'travaux');
  await au.step('verrou', async () => {
    await panel(page).getByRole('radio', { name: 'État des lieux' }).click();
    await panel(page).getByRole('button', { name: 'Verrouiller les murs extérieurs' }).click();
    await page.waitForTimeout(300);
    au.note('verrou', await messages(page));
    await panel(page).getByRole('radio', { name: 'Travaux' }).click();
  });
  // cloison qui coupe la salle de bain carrelée
  await au.step('cloison-sdb', async () => {
    await panel(page).getByRole('button', { name: 'Tracer une cloison' }).click();
    const sdb = page.locator('polygon.floor').nth(2);
    const b = (await sdb.boundingBox())!;
    await tap(page, b.x + b.width * 0.4, b.y + 3, au.isTouch);
    await tap(page, b.x + b.width * 0.4, b.y + b.height - 3, au.isTouch);
    await page.waitForTimeout(500);
    const d = page.getByRole('dialog', { name: 'Des revêtements seront réduits' });
    au.note('surface-perdue', await d.innerText().catch(() => 'pas de fenêtre'));
    await au.shot('plan', 'surface-perdue');
    await d
      .getByRole('button', { name: 'Annuler' })
      .click()
      .catch(() => undefined);
  });
  await au.step('demolir', async () => {
    await panel(page).getByRole('button', { name: 'Démolir un mur' }).click();
    await au.shot('plan', 'demolir');
    au.note('demolir-aide', await panel(page).innerText());
    const w = page.locator('[data-k="xwall"]').first();
    await w.click({ force: true });
    await page.waitForTimeout(400);
    au.note('demolition', await panel(page).locator('h2').allInnerTexts());
    await au.shot('plan', 'demolition');
  });
  au.note(
    'problemes',
    await page
      .getByRole('region', { name: /Problèmes/ })
      .allInnerTexts()
      .catch(() => []),
  );
});

test('C14 épaisseur des murs, hauteur sous plafond : limites', async ({ page, au }) => {
  await createProject(page, { project: 'C14', name: 'Pièce', size: [400, 300] });
  await roomBtn(page, 'Pièce')
    .click()
    .catch(() => undefined);
  const res: Record<string, unknown> = {};
  for (const [label, vals] of [
    ['Hauteur sous plafond', ['0', '50', '100000', '250']],
    ['Épaisseur des murs', ['0', '1', '1000', '72']],
  ] as const)
    for (const v of vals) {
      const shown = await typeIn(panel(page), label, v).catch(() => 'absent');
      res[`${label}=${v}`] = { affiche: shown, messages: await messages(page) };
      if (v === '1000' || v === '100000') await au.shot('plan', `${label.split(' ')[0]}-${v}`);
    }
  au.note('limites', res);
  // réglage par défaut des nouvelles pièces
  await page.goto('/#/settings');
  for (const v of ['0', '-5', 'abc', '72']) {
    const shown = await typeIn(page, 'Épaisseur des murs', v);
    res[`reglages=${v}`] = { affiche: shown, messages: await messages(page) };
  }
  au.note('reglages', res);
});
