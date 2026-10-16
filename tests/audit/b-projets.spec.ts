/** B. Projets : créer, formes, renommer, dupliquer, supprimer, projet sans carrelage, beaucoup de projets. */
import type { Page } from '@playwright/test';
import { cover, openRoom } from '../e2e/helpers';
import { dumpDb, expect, fixture, seed, tap, test, typeIn } from './audit';

/** Ouvre la fenêtre « Nouveau projet » et la remplit ; renvoie le nombre d'actions. */
async function newProject(page: Page, shape: string, fields: Record<string, string>): Promise<number> {
  await page.goto('/#/new');
  const d = page.getByRole('dialog', { name: 'Nouveau projet' });
  await d.waitFor();
  let n = 1;
  if (shape !== 'Rectangle') {
    await d.getByRole('radio', { name: shape }).click();
    n++;
  }
  for (const [k, v] of Object.entries(fields)) {
    await typeIn(d, k, v);
    n++;
  }
  return n;
}

test('B1 créer un projet (rectangle) : étapes, taps, résultat', async ({ page, au }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nouveau projet' }).first().click();
  const d = page.getByRole('dialog', { name: 'Nouveau projet' });
  await d.waitFor();
  await au.shot('nouveau-projet', 'fenetre');
  await au.check('nouveau-projet');
  au.note(
    'valeurs-proposees',
    await d
      .locator('input')
      .evaluateAll((is) => is.map((i) => `${i.getAttribute('aria-label') ?? i.id}=${(i as HTMLInputElement).value}`)),
  );
  // créer sans rien changer : combien de taps au minimum ?
  await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForURL(/#\/p\/[^/]+\/plan$/);
  au.note('taps-minimum', 2);
  await au.shot('plan', 'apres-creation');
  au.note('apres-creation', { url: page.url().replace(/^.*#/, '#'), titre: await page.locator('h1').innerText() });
  // retour : vers le projet ou l'accueil ?
  await page
    .getByRole('link', { name: /Projet|Accueil/ })
    .first()
    .click();
  await page.waitForTimeout(800);
  au.note('retour-depuis-plan', page.url().replace(/^.*#/, '#'));
  await au.shot('projet', 'nouveau');
  // un second « Nouveau projet » puis Annuler : projet vide créé ?
  await page.goto('/#/new');
  await page.getByRole('dialog', { name: 'Nouveau projet' }).getByRole('button', { name: 'Annuler' }).click();
  await page.waitForTimeout(500);
  await au.shot('nouveau-projet', 'annule');
  au.note('apres-annuler', { url: page.url().replace(/^.*#/, '#'), h1: await page.locator('h1').allInnerTexts() });
  await page.goto('/#/');
  au.note('projets-apres-annuler', await page.getByRole('list', { name: 'Projets' }).getByRole('listitem').count());
});

test('B2 créer en L, en U et en dessin libre', async ({ page, au }) => {
  for (const shape of ['En L', 'En U'] as const) {
    const n = await newProject(page, shape, { 'Nom du projet': `Projet ${shape}`, Longueur: '500', Largeur: '400' });
    const d = page.getByRole('dialog', { name: 'Nouveau projet' });
    await au.shot('nouveau-projet', shape === 'En L' ? 'forme-L' : 'forme-U');
    // retrait trop grand : message
    const big = shape === 'En L' ? 'Retrait en longueur' : 'Largeur des ailes';
    await typeIn(d, big, '600');
    au.note(`${shape}:message-retrait`, await d.getByRole('alert').allInnerTexts());
    au.note(`${shape}:ajouter-actif`, await d.getByRole('button', { name: 'Ajouter', exact: true }).isEnabled());
    await au.shot('nouveau-projet', shape === 'En L' ? 'forme-L-erreur' : 'forme-U-erreur');
    await typeIn(d, big, shape === 'En L' ? '200' : '150');
    await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.waitForURL(/\/plan$/);
    au.note(`${shape}:taps`, n + 1);
    await au.shot('plan', shape === 'En L' ? 'piece-L' : 'piece-U');
  }
  // dessin libre : 4 coins puis le premier
  await page.goto('/#/new');
  const d = page.getByRole('dialog', { name: 'Nouveau projet' });
  await d.getByRole('radio', { name: 'Dessin' }).click();
  await au.shot('nouveau-projet', 'dessin');
  await d.getByRole('button', { name: 'Commencer le dessin' }).click();
  const app = page.getByRole('application').first();
  const b = (await app.boundingBox())!;
  const pts: [number, number][] = [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.7, 0.6],
    [0.3, 0.6],
    [0.3, 0.3],
  ];
  for (const [x, y] of pts) {
    await tap(page, b.x + b.width * x, b.y + b.height * y, au.isTouch);
    await page.waitForTimeout(250);
  }
  await au.shot('plan', 'dessin-ferme');
  const naming = page.getByRole('dialog', { name: 'Nommer la pièce' });
  au.note('dessin:fenetre-nom', await naming.isVisible());
  await au.step('dessin-creer', async () => {
    await naming.getByRole('button', { name: 'Créer la pièce' }).click();
    await page.waitForURL(/\/plan$/, { timeout: 5000 });
    au.note('dessin:url', page.url().replace(/^.*#/, '#'));
  });
  await au.shot('plan', 'dessin-cree');
});

test('B3 renommer (carte de l’accueil et plan)', async ({ page, au }) => {
  await seed(page, 'maison');
  const card = page.getByRole('listitem').filter({ hasText: 'Maison Dupont' });
  const menu = card.getByRole('button', { name: /^Actions pour/ });
  au.note('menu-carte', await menu.count());
  await au.step('renommer-carte', async () => {
    await menu.click();
    const d = page.getByRole('dialog', { name: 'Maison Dupont' });
    await au.shot('accueil', 'menu-carte');
    await d.getByRole('button', { name: 'Renommer' }).click();
    await d.getByLabel('Nouveau nom').fill('');
    await au.shot('accueil', 'renommer-vide');
    au.note(
      'renommer-vide-bouton',
      await d
        .getByRole('button', { name: /Renommer|Enregistrer|Valider/ })
        .last()
        .isEnabled(),
    );
    await d.getByLabel('Nouveau nom').fill('Maison Dupont — RDC 🏠');
    await d.getByLabel('Nouveau nom').press('Enter');
    await page.waitForTimeout(500);
    au.note('nom-apres-carte', await page.getByRole('list', { name: 'Projets' }).innerText());
  });
  // depuis le plan : nom vide accepté ?
  await page
    .getByRole('link', { name: /Maison Dupont/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Modifier le plan' }).click();
  await page.getByRole('button', { name: 'Renommer le projet' }).click();
  const d = page.getByRole('dialog', { name: 'Renommer le projet' });
  await d.getByLabel('Nom du projet').fill('   ');
  await d.getByRole('button', { name: 'Renommer' }).click();
  await page.waitForTimeout(300);
  au.note('plan-nom-espaces', { h1: await page.locator('h1').innerText(), fenetreOuverte: await d.isVisible() });
  await au.shot('plan', 'renomme-vide');
});

test('B4 dupliquer', async ({ page, au }) => {
  await seed(page, 'maison');
  await au.step('dupliquer', async () => {
    await page
      .getByRole('button', { name: /^Actions pour/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Dupliquer' }).click();
    await page.waitForURL(/#\/p\/[^/]+$/);
    au.note('apres-dupliquer', { url: page.url().replace(/^.*#/, '#'), h1: await page.locator('h1').innerText() });
    await au.shot('projet', 'copie');
    await page.goto('/#/');
    await page.waitForTimeout(800);
    au.note('liste', await page.getByRole('list', { name: 'Projets' }).innerText());
    await au.shot('accueil', 'apres-copie');
    // la copie est-elle indépendante ? (prix modifié dans l'une)
  });
});

test('B5 supprimer, annuler, fermer pendant le délai', async ({ page, context, au }) => {
  await seed(page, 'maison');
  await page
    .getByRole('button', { name: /^Actions pour/ })
    .first()
    .click();
  await au.shot('accueil', 'menu');
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(300);
  au.note('confirmation-demandee', await page.getByRole('dialog').count());
  await au.shot('accueil', 'supprime');
  au.note('toast', await page.getByRole('status').allInnerTexts());
  await au.step('annuler', async () => {
    await page.getByRole('button', { name: 'Annuler' }).click();
    await page.waitForTimeout(300);
    au.note('apres-annuler', await page.getByRole('list', { name: 'Projets' }).count());
  });
  // supprimer puis fermer l'onglet avant 6,5 s : le projet revient-il ?
  await page
    .getByRole('button', { name: /^Actions pour/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(500);
  await page.close();
  const p2 = await context.newPage();
  await p2.goto('/#/');
  await p2.locator('h1').first().waitFor();
  await p2.waitForTimeout(1000);
  au.note('apres-fermeture', {
    projets: await p2.getByRole('list', { name: 'Projets' }).count(),
    texte: (await p2.locator('main, body').first().innerText()).slice(0, 200),
  });
  // durée du toast d'annulation
  await p2.close();
});

test('B6 projet sans carrelage : actions de l’accueil', async ({ page, au }) => {
  await newProject(page, 'Rectangle', { 'Nom du projet': 'Parquet seul', Longueur: '400', Largeur: '300' });
  await page
    .getByRole('dialog', { name: 'Nouveau projet' })
    .getByRole('button', { name: 'Ajouter', exact: true })
    .click();
  await page.waitForURL(/\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await openRoom(page, id, 'Pièce 1').catch(async () =>
    openRoom(page, id, (await page.locator('h1').innerText()).trim()),
  );
  await au.step('parquet', () => cover(page, 'Sol', 'parquet'));
  await page.goto('/#/');
  await page.waitForTimeout(1000);
  await au.shot('accueil', 'sans-carrelage');
  const card = page.getByRole('listitem').filter({ hasText: 'Parquet seul' });
  au.note('carte', { texte: await card.innerText(), menu: await card.getByRole('button').count() });
  // un projet sans aucun revêtement non plus
  await newProject(page, 'Rectangle', { 'Nom du projet': 'Vide' });
  await page
    .getByRole('dialog', { name: 'Nouveau projet' })
    .getByRole('button', { name: 'Ajouter', exact: true })
    .click();
  await page.waitForURL(/\/plan$/);
  await page.goto('/#/');
  await page.waitForTimeout(800);
  au.note(
    'cartes',
    await page
      .getByRole('list', { name: 'Projets' })
      .getByRole('listitem')
      .evaluateAll((ls) =>
        ls.map((l) => ({
          t: (l as HTMLElement).innerText.replace(/\s+/g, ' '),
          boutons: l.querySelectorAll('button').length,
        })),
      ),
  );
  await au.check('accueil-mixte');
});

test('B7 25 projets, noms longs, emoji, vides', async ({ page, au }) => {
  const base = fixture('maison');
  const src = base.stores['projects']!.rows[0]!.value as { id: string; name: string; updatedAt: number };
  const names = [
    'Rénovation complète de la maison de campagne de Mme et M. Grandjean-Delacroix, rez-de-chaussée et étage',
    '🛁 Salle de bain 🚿',
    '',
    '   ',
    'Ｗｉｄｅ　ｔｅｘｔ',
    'AnticonstitutionnellementAnticonstitutionnellementAnticonstitutionnellement',
    ...Array.from({ length: 19 }, (_, i) => `Chantier ${i + 1}`),
  ];
  const rows = names.map((name, i) => ({
    key: undefined,
    value: { ...src, id: `p-${i}`, name, updatedAt: src.updatedAt - i * 3600_000 },
  }));
  await seed(page, { stores: { ...base.stores, projects: { keyPath: true, rows } } });
  await page.waitForTimeout(3000);
  await au.shot('accueil', '25-projets');
  await au.shot('accueil', '25-projets-ecran', { full: false });
  await au.check('accueil-25');
  au.note('hauteur-page', await page.evaluate(() => document.documentElement.scrollHeight));
  au.note('recherche-tri', {
    recherche: await page.getByRole('searchbox').count(),
    tri: await page.getByRole('combobox').count(),
  });
  au.note(
    'nom-vide-affiche',
    await page
      .getByRole('listitem')
      .nth(2)
      .innerText()
      .catch(() => ''),
  );
  // un nom vide ouvre-t-il un projet atteignable (lien accessible) ?
  au.note(
    'liens-sans-nom',
    await page.locator('a[href^="#/p/"]').evaluateAll((as) => as.filter((a) => !(a.textContent ?? '').trim()).length),
  );
  // calculs des vignettes : temps avant que tout soit affiché
  const t0 = Date.now();
  await page.reload();
  await expect(page.getByText(/€|prix à saisir/).nth(20))
    .toBeVisible({ timeout: 60_000 })
    .catch(() => undefined);
  au.note('ms-vignettes-25', Date.now() - t0);
  void dumpDb;
});

test('B8 lien « ancienne version » de l’accueil vide', async ({ page, au }) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Mes projets' }).waitFor();
  const link = page.getByRole('link', { name: /Importez vos données/ });
  au.note('present', await link.count());
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(500);
    au.note('destination', page.url().replace(/^.*#/, '#'));
    au.note('import-possible', await page.getByRole('button', { name: /Importer/ }).count());
    await au.shot('reglages', 'cul-de-sac-import');
  }
});
