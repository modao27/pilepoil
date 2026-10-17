/** Saisie des nombres (lot E) : unités, refus expliqués, bornes annoncées, valeurs inhabituelles signalées. */
import { expect, test } from '@playwright/test';
import { cover, createProject, fillNumber, openRoom } from './helpers';

test('cotes : unités acceptées, refus et bornes expliqués, valeur inhabituelle signalée', async ({ page }) => {
  await page.goto('/#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  const length = dialog.getByLabel('Longueur', { exact: true });
  const msg = dialog.locator('p.msg').first();

  // des unités dans la saisie, converties en cm
  for (const [typed, shown] of [
    ['2,4 m', '240'],
    ['4000 mm', '400'],
    ['1 m + 20 cm', '120'],
  ] as const) {
    await fillNumber(dialog, 'Longueur', typed);
    await expect(length).toHaveValue(shown);
  }

  // saisie incompréhensible : la valeur d'avant revient et le message le dit
  await fillNumber(dialog, 'Longueur', '3 pieds');
  await expect(length).toHaveValue('120');
  await expect(msg).toContainText('valeur conservée : 120 cm');

  // hors bornes : ramené à la borne, avec la raison
  await fillNumber(dialog, 'Longueur', '-50');
  await expect(length).toHaveValue('10');
  await expect(msg).toContainText('Ramené à 10 cm');
  await fillNumber(dialog, 'Longueur', '200 m');
  await expect(length).toHaveValue('10000');
  await expect(msg).toContainText('Ramené à 10');

  // valeur acceptée mais inhabituelle (mur de 30 cm, ou de 40 m)
  await fillNumber(dialog, 'Longueur', '30');
  await expect(msg).toContainText('inhabituel');
  await fillNumber(dialog, 'Longueur', '4000');
  await expect(msg).toContainText('inhabituel');
  await fillNumber(dialog, 'Longueur', '400');
  await expect(msg).toBeEmpty();
});

test('zone de mur : hauteurs incohérentes expliquées sous le champ, hauteur de pièce annoncée', async ({ page }) => {
  const id = await createProject(page, { name: 'Salle', size: [300, 240] });
  await openRoom(page, id, 'Salle');
  await cover(page, 'Mur 1', 'carrelage');

  await fillNumber(page, 'Depuis le sol', '150');
  await fillNumber(page, 'Jusqu’à', '90');
  const alert = page.getByRole('alert').filter({ hasText: 'Le haut de la zone doit être au-dessus du bas' });
  await expect(alert).toHaveCount(1);

  // saisie correcte : le message disparaît ; au-delà du plafond, la hauteur est ramenée et le dit
  await fillNumber(page, 'Jusqu’à', '400');
  await expect(alert).toHaveCount(0);
  await expect(page.getByLabel('Jusqu’à', { exact: true })).toHaveValue('250');
  await expect(page.getByText(/Ramené à 250 cm/)).toBeVisible();
});
