import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

test('système de design : clair et sombre, accessible', async ({ page }, info) => {
  await page.goto('/#/demo');
  await expect(page.getByRole('heading', { name: 'Système de design' })).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '00-demo-clair');

  await page.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectAccessible(page);
  await shot(page, info, '00-demo-sombre');
});

test('composants : saisie calculée, onglets, liste, dialogue, panneau, message', async ({ page }) => {
  await page.goto('/#/demo');

  const width = page.getByLabel('Largeur de la surface', { exact: true });
  await width.fill('240-12');
  await width.press('Enter');
  await expect(width).toHaveValue('228');
  await page.getByRole('button', { name: 'Augmenter Largeur de la surface' }).click();
  await expect(width).toHaveValue('229');
  await width.fill('abc');
  await width.blur();
  await expect(page.getByText('Saisissez un nombre, par exemple 240 ou 240-12.')).toBeVisible();

  await page.getByRole('tab', { name: 'Motif' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Contenu de l’onglet « Motif »');
  await page.getByRole('tab', { name: 'Motif' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Zones' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Descendre Zone 1 — frise, 3 rangées' }).click();
  await expect(page.getByRole('list', { name: 'Zones' }).getByRole('listitem').first()).toContainText('Zone 2');

  await page.getByRole('radio', { name: 'Bâtons rompus' }).click();
  await expect(page.getByRole('radio', { name: 'Bâtons rompus' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Ouvrir un dialogue' }).click();
  await expect(page.getByRole('dialog', { name: 'Supprimer la zone ?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  const handle = page.getByRole('button', { name: /^Réglages : mi-hauteur/ });
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: /^Réglages : plein écran/ })).toBeVisible();

  await page.getByRole('button', { name: 'Afficher un message' }).click();
  await expect(page.getByText('Zone supprimée.')).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByText('Zone rétablie.')).toBeVisible();
});
