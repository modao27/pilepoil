/**
 * Sécurité des données (docs/PLAN.md, N0) : suppression d'une pièce revêtue confirmée, annulation qui
 * n'écrase jamais un changement fait depuis, enregistrement refusé signalé et réessayable.
 */
import { expect, test, type Page } from '@playwright/test';
import { newWall } from './helpers';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));

/** Plan du projet, pièce « Pièce » sélectionnée. */
async function selectRoom(page: Page, id: string) {
  await page.goto(`/#/p/${id}/plan`);
  await panel(page).getByRole('button', { name: 'Pièce', exact: true }).click();
}

test('pièce revêtue : la suppression détaille ce qui sera perdu, et se confirme', async ({ page }) => {
  const id = await newWall(page);
  await selectRoom(page, id);
  await panel(page).getByRole('button', { name: 'Supprimer la pièce' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer la pièce ?' });
  await expect(dialog).toContainText('Carrelage : mur 1.');
  await dialog.getByRole('button', { name: 'Garder la pièce' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();

  await panel(page).getByRole('button', { name: 'Supprimer la pièce' }).click();
  await dialog.getByRole('button', { name: 'Supprimer la pièce' }).click();
  await expect(page.getByText('Pièce « Pièce » supprimée.')).toBeVisible();
  // annulation juste après : la pièce et son carrelage reviennent
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await page.goto(`/#/p/${id}/m/carrelage`);
  await expect(page.getByRole('link', { name: 'Ouvrir Pièce, mur 1' })).toBeVisible();
});

test('annuler après un changement fait ailleurs : refusé, rien n’est écrasé', async ({ page }) => {
  const id = await newWall(page);
  await selectRoom(page, id);
  await panel(page).getByRole('button', { name: 'Supprimer la pièce' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer la pièce' }).click();
  await expect(page.getByText('Pièce « Pièce » supprimée.')).toBeVisible();

  // autre écran : le projet est renommé pendant que le message est encore là
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Actions pour Pièce 300 × 240' }).click();
  await page.getByRole('button', { name: 'Renommer' }).click();
  await page.getByLabel('Nouveau nom').fill('Crédence');
  await page.getByRole('dialog').getByRole('button', { name: 'Renommer' }).click();
  await expect(page.getByRole('link', { name: 'Crédence' })).toBeVisible();

  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByText('Impossible d’annuler : le projet a été modifié depuis.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Crédence' })).toBeVisible();
});

test('enregistrement refusé : message, puis « Réessayer » enregistre', async ({ page }) => {
  // écritures IndexedDB refusées tant que window.__failSave vaut true
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<typeof put>) {
      if ((window as unknown as { __failSave?: boolean }).__failSave && this.name === 'projects')
        throw new DOMException('Plus de place', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  const id = await newWall(page);
  await page.goto(`/#/p/${id}/m/carrelage`);
  await page.evaluate(() => ((window as unknown as { __failSave: boolean }).__failSave = true));
  await page.getByRole('checkbox', { name: /^Mur 2 / }).check();
  await expect(page.getByText(/^Enregistrement impossible/)).toBeVisible();
  // rien n'est faussement affiché comme enregistré
  await expect(page.getByRole('link', { name: 'Ouvrir Pièce, mur 2' })).toHaveCount(0);

  await page.evaluate(() => ((window as unknown as { __failSave: boolean }).__failSave = false));
  await page.getByRole('status').getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByRole('link', { name: 'Ouvrir Pièce, mur 2' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Ouvrir Pièce, mur 2' })).toBeVisible();
});
