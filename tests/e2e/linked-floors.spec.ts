/**
 * Sols reliés et zones (PLAN N3) : une pièce posée contre une autre, une porte entre elles en une action, un
 * carrelage qui continue d'une pièce à l'autre, puis un parquet sur les deux ; un sol découpé par une ligne, une
 * partie en carrelage et l'autre en parquet. Téléphone et ordinateur.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  addTile,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  openPose,
  openRoom,
  selectSurface,
  shot,
  step,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

const floorButton = (page: Page, what: RegExp) =>
  page.getByRole('region', { name: 'Sol et murs' }).getByRole('button', { name: what });

test('deux pièces collées, porte vers la voisine, carrelage puis parquet continus, sol partagé', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await addTile(page);

  // le séjour, puis le bureau contre son mur 2 ; une porte vers la voisine
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await fillNumber(dialog, 'Nom', 'Bureau');
  await fillNumber(dialog, 'Longueur', '300');
  await fillNumber(dialog, 'Largeur', '300');
  await dialog.getByLabel('Emplacement').selectOption({ label: 'Contre Séjour, mur 2' });
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const plan = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await plan.getByRole('button', { name: 'Porte vers Séjour' }).click();
  await expect(plan.getByRole('heading', { name: 'Passage' })).toBeVisible();

  // carrelage au sol du séjour, puis le bureau continue la même pose (porte entre les deux)
  await openRoom(page, id, 'Séjour');
  await selectSurface(page, 'Sol');
  await page.getByRole('button', { name: 'Revêtir : carrelage' }).click();
  await openRoom(page, id, 'Bureau');
  await selectSurface(page, 'Sol');
  await page.getByRole('button', { name: 'Revêtir : carrelage' }).click();
  const choose = page.getByRole('dialog', { name: 'Carrelage : sol' });
  await choose.getByRole('button', { name: 'Continuer « Séjour, sol »' }).click();
  await expect(floorButton(page, /^Sol : Carrelage · Séjour \+ Bureau, sol$/)).toBeVisible();
  await check(page);
  await shot(page, info, 'N3-sols-relies');
  await openPose(page, 'Sol');
  await expect(page.getByRole('application', { name: /^Plan de Séjour \+ Bureau, sol/ })).toBeVisible();

  // le bureau passe en parquet ; le séjour le rejoint : une pose de parquet sur les deux pièces
  await openRoom(page, id, 'Bureau');
  await selectSurface(page, 'Sol');
  await page.getByRole('button', { name: 'Passer en parquet' }).click();
  await expect(floorButton(page, /^Sol : Parquet · (Séjour \+ )?Bureau, sol$/)).toBeVisible();
  await openRoom(page, id, 'Séjour');
  await selectSurface(page, 'Sol');
  await page.getByRole('button', { name: 'Retirer' }).click();
  await expect(floorButton(page, /^Sol : sans revêtement$/)).toBeVisible();
  await page.getByRole('button', { name: 'Revêtir : parquet' }).click();
  await page
    .getByRole('dialog', { name: 'Parquet : sol' })
    .getByRole('button', { name: 'Continuer « Bureau, sol »' })
    .click();
  await expect(floorButton(page, /^Sol : Parquet · (Séjour \+ )?Bureau, sol$/)).toBeVisible();
  await openPose(page, 'Sol');
  const p = page.getByRole('complementary', { name: 'Réglages du parquet' }).or(page.locator('.sheet'));
  await step(page, 'Découpage');
  await expect(p.getByRole('checkbox', { name: 'Séjour' })).toBeChecked();
  await expect(p.getByRole('checkbox', { name: 'Bureau' })).toBeChecked();

  // le séjour : sol découpé par une ligne, une partie repasse en carrelage
  await openRoom(page, id, 'Séjour');
  await selectSurface(page, 'Sol');
  await page.getByRole('button', { name: 'Découper par une ligne' }).click();
  const drawing = page.getByRole('group', { name: /^Séjour : sol au centre/ });
  const box = (await drawing.boundingBox())!;
  await drawing.click({ position: { x: box.width * 0.5, y: box.height * 0.4 } });
  await drawing.click({ position: { x: box.width * 0.5, y: box.height * 0.6 } });
  await expect(page.getByText('Sol découpé en deux zones.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Passer en carrelage' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Passer en carrelage' }).first().click();
  await expect(
    floorButton(
      page,
      /^Sol : (Parquet · Séjour \+ Bureau, sol, Carrelage · Séjour, sol|Carrelage · Séjour, sol(?: \(\d\))?, Parquet · Séjour \+ Bureau, sol)$/,
    ),
  ).toBeVisible();
  await check(page);
  await shot(page, info, 'N3-sol-partage');
});
