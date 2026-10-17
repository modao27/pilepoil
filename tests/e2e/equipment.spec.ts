/** Équipements fixes du plan : WC, receveur, baignoire… à leur taille usuelle, placés en cotes (PLAN N5). */
import { expect, test, type Page } from '@playwright/test';
import {
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  shot,
} from './helpers';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));

test('salle de bain : receveur et WC ajoutés à leur taille, placés en cotes, sol dessous au choix', async ({
  page,
}, info) => {
  await createProject(page, { project: 'Appartement', name: 'Salle de bain', size: [300, 240] });
  const p = panel(page);
  await expect(p.getByRole('heading', { name: 'Salle de bain' })).toBeVisible();

  // un receveur : 90 × 90 cm, le sol est découpé autour
  await p.getByLabel('Équipement', { exact: true }).selectOption({ label: 'Receveur de douche' });
  await p.getByRole('button', { name: 'Ajouter l’équipement' }).click();
  await expect(p.getByRole('heading', { name: 'Obstacle — Salle de bain' })).toBeVisible();
  await expect(p.getByLabel('Largeur', { exact: true })).toHaveValue('90');
  await expect(p.getByLabel('Profondeur', { exact: true })).toHaveValue('90');
  await expect(p.getByRole('checkbox', { name: /Le revêtement du sol passe dessous/ })).not.toBeChecked();
  await fillNumber(p, 'Distance au mur de gauche', '0');
  await fillNumber(p, 'Distance au mur du haut', '0');
  await expect(page.locator('text.eq', { hasText: 'Receveur de douche' })).toBeVisible();

  // un WC : 40 × 70 cm, le sol passe dessous
  await p.getByRole('button', { name: 'Retour à Salle de bain' }).click();
  await p.getByLabel('Équipement', { exact: true }).selectOption({ label: 'WC' });
  await p.getByRole('button', { name: 'Ajouter l’équipement' }).click();
  await expect(p.getByLabel('Largeur', { exact: true })).toHaveValue('40');
  await expect(p.getByLabel('Profondeur', { exact: true })).toHaveValue('70');
  await expect(p.getByRole('checkbox', { name: /Le revêtement du sol passe dessous/ })).toBeChecked();
  await expect(page.locator('polygon.obstacle.under')).toHaveCount(1);
  await expect(page.locator('polygon.obstacle')).toHaveCount(2);

  // le choix s'inverse : le WC devient un trou du sol
  await p.getByRole('checkbox', { name: /Le revêtement du sol passe dessous/ }).uncheck();
  await expect(page.locator('polygon.obstacle.under')).toHaveCount(0);

  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '71-equipements');
});
