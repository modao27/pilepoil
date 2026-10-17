/** Relevé sur place : une pièce en L saisie mur après mur, écart de fermeture, diagonale de contrôle. */
import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, fillNumber, shot } from './helpers';

test('relevé : une pièce en L mur après mur, refus quand elle ne ferme pas, contrôle par une diagonale', async ({
  page,
}, info) => {
  await page.goto('/#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialog.getByRole('radio', { name: 'Relevé' }).click();
  await fillNumber(dialog, 'Nom', 'Séjour');

  // six murs : 6 m, 3 m, 3 m (coin rentrant après), 2 m, 3 m, 5 m
  await dialog.getByRole('button', { name: 'Ajouter un mur' }).click();
  await dialog.getByRole('button', { name: 'Ajouter un mur' }).click();
  const lengths = ['600', '300', '300', '200', '300', '450'];
  for (const [i, v] of lengths.entries()) await fillNumber(dialog, `Mur ${i + 1}`, v);
  await dialog
    .getByRole('radiogroup', { name: 'Coin après le mur 3' })
    .getByRole('radio', { name: 'Rentrant' })
    .click();

  // le dernier mur est trop court de 50 cm : la pièce ne ferme pas, elle ne se crée pas
  const add = dialog.getByRole('button', { name: 'Ajouter', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('La pièce ne ferme pas : 50 cm d’écart');
  await expect(add).toBeDisabled();

  // cote corrigée : la pièce ferme
  await fillNumber(dialog, 'Mur 6', '500');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(add).toBeEnabled();

  // diagonale de contrôle du coin 1 au coin 5 : √(3² + 5²) = 5,831 m
  await dialog.getByText('Contrôler avec une diagonale').click();
  await dialog.getByLabel('De', { exact: true }).selectOption({ label: 'Coin 1' });
  await dialog.getByLabel('À', { exact: true }).selectOption({ label: 'Coin 5' });
  await fillNumber(dialog, 'Longueur mesurée', '583,1');
  await expect(dialog.getByText('La diagonale correspond au plan.')).toBeVisible();
  await fillNumber(dialog, 'Longueur mesurée', '590');
  await expect(dialog.getByText(/Écart de \+\d+ mm avec le plan : une cote ou un angle est faux\./)).toBeVisible();

  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '69-releve');

  // création : la pièce en L fait 6 × 5 − 3 × 2 = 24 m²
  await add.click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  await expect(page.locator('text.name tspan.area')).toHaveText('24 m²');
});
