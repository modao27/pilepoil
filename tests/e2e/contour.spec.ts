/**
 * Découpe d'un sol par un contour (PLAN N4) : une entrée tracée point par point dans un séjour en parquet, puis
 * passée en carrelage ; le parquet garde le reste. Téléphone et ordinateur.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  addTile,
  cover,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  openRoom,
  selectSurface,
  shot,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('entrée carrelée tracée dans un séjour en parquet', async ({ page }, info) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [500, 400] });
  await openRoom(page, id, 'Séjour');
  await cover(page, 'Sol', 'parquet');

  // contour : quatre coins sur le sol, puis le premier pour fermer
  await page.getByRole('button', { name: 'Découper par un contour' }).click();
  const drawing = page.getByRole('group', { name: /^Séjour : sol au centre/ });
  const box = (await drawing.boundingBox())!;
  const at = (fx: number, fy: number) => drawing.click({ position: { x: box.width * fx, y: box.height * fy } });
  await at(0.42, 0.42);
  await at(0.58, 0.425);
  await at(0.575, 0.58);
  await expect(page.getByText('3 points')).toBeVisible();
  await check(page);
  await shot(page, info, 'N4-contour');
  await at(0.42, 0.575);
  await at(0.42, 0.42);
  await expect(page.getByText('Contour découpé : l’intérieur est une nouvelle pose.')).toBeVisible();

  // l'intérieur (nouvelle pose de parquet) passe en carrelage
  const list = page.getByRole('region', { name: 'Sol et murs' });
  await expect(
    list.getByRole('button', { name: /^Sol : Parquet · Séjour, sol, Parquet · Séjour, sol \(2\)$/ }),
  ).toBeVisible();
  await page.locator('li', { hasText: 'contour dessiné' }).getByRole('button', { name: 'Passer en carrelage' }).click();
  await expect(
    list.getByRole('button', { name: /^Sol : Parquet · Séjour, sol, Carrelage · Séjour, sol \(3\)$/ }),
  ).toBeVisible();
  await expect(page.locator('li', { hasText: 'contour dessiné' })).toContainText('Carrelage · Séjour, sol (3)');
  await check(page);
  await shot(page, info, 'N4-entree-carrelee');

  // les deux calepinages s'ouvrent : le parquet autour, le carrelage dans l'entrée
  await selectSurface(page, 'Sol');
  await page.locator('li', { hasText: 'Parquet · Séjour, sol' }).getByRole('link', { name: 'Calepinage' }).click();
  await expect(page.getByRole('application', { name: /^Plan des lames : \d+ lames/ })).toBeVisible();
  await expect(page.locator('line.threshold:not(.proposed)')).toHaveCount(4);
});
