/** Aide et prise en main : présentation du premier lancement, page « Comment ça marche », (i) sur les mots du métier. */
import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, newWall, savedPref, shot } from './helpers';

test('premier lancement : trois écrans, une seule fois, rouvrables depuis l’aide', async ({ page }, info) => {
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'Dessinez vos pièces' });
  await expect(intro).toBeVisible();
  await expect(intro.getByText('Écran 1 sur 3')).toBeVisible();
  await expectAccessible(page);
  await shot(page, info, '02-bienvenue');
  await intro.getByRole('button', { name: 'Suivant' }).click();
  const second = page.getByRole('dialog', { name: 'Touchez une surface pour la revêtir' });
  await expect(second.getByText('Écran 2 sur 3')).toBeVisible();
  await second.getByRole('button', { name: 'Suivant' }).click();
  const third = page.getByRole('dialog', { name: 'Commandez juste ce qu’il faut' });
  await third.getByRole('button', { name: 'Commencer' }).click();
  // « Commencer » mène à la création du premier projet
  await expect(page.getByRole('dialog', { name: 'Nouveau projet' })).toBeVisible();

  // vue une fois : plus de présentation au lancement suivant
  await expect.poll(() => savedPref(page, 'welcomeSeen')).toBe(true);
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Dessinez vos pièces' })).toHaveCount(0);

  // la page d'aide la rouvre
  await page.goto('/#/aide');
  await expect(page).toHaveTitle('Comment ça marche · PilePoil');
  await page.getByRole('button', { name: 'Revoir la présentation' }).click();
  await expect(page.getByRole('dialog', { name: 'Dessinez vos pièces' })).toBeVisible();
  await page.getByRole('button', { name: 'Passer' }).click();
});

test('passer la présentation suffit à ne plus la revoir', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Passer' }).click();
  // l'écriture est asynchrone : un rechargement trop tôt l'interromprait
  await expect.poll(() => savedPref(page, 'welcomeSeen')).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('comment ça marche : les étapes et les mots du métier', async ({ page }, info) => {
  await page.goto('/#/aide');
  await expect(page.getByRole('heading', { name: 'En trois étapes' })).toBeVisible();
  for (const word of ['Calepinage', 'Pose', 'Coupe fine', 'Coupe perdue', 'État des lieux', 'Travaux'])
    await expect(page.getByRole('term').filter({ hasText: new RegExp(`^${word}$`) })).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '03-aide');
  await page.goto('/#/settings');
  await page.getByRole('link', { name: 'Comment ça marche' }).click();
  await expect(page).toHaveURL(/#\/aide$/);
});

test('(i) à côté d’un mot du métier : l’explication s’ouvre et se ferme', async ({ page }) => {
  await newWall(page);
  // téléphone : le panneau de réglages est replié, on le déplie
  const handle = page.getByRole('button', { name: /^Réglages :/ });
  if ((await handle.count()) && (await handle.getAttribute('aria-expanded')) !== 'true') await handle.click();
  const tip = page.getByRole('button', { name: /Que veut dire « calepinage » \?/ }).first();
  await tip.click();
  const dialog = page.getByRole('dialog', { name: 'Calepinage' });
  await expect(dialog).toContainText('Le plan de pose');
  await dialog.getByRole('link', { name: 'Tous les mots expliqués' }).click();
  await expect(page).toHaveURL(/#\/aide$/);
});
