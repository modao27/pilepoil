import { expect, type Page } from '@playwright/test';

/** Pièce de 15 m² (4 × 3,75 m, 2,50 m sous plafond, carrelée sur 2 m), créée par l'assistant. */
export async function newRoom(page: Page, tile?: [number, number]): Promise<string> {
  await page.goto('/#/new/carrelage');
  for (const [label, v] of [
    ['Longueur de la pièce', '400'],
    ['Largeur de la pièce', '375'],
  ] as const) {
    const f = page.getByLabel(label, { exact: true });
    await f.fill(v);
    await f.press('Enter');
  }
  await page.getByRole('button', { name: 'Suivant' }).click();
  // sol et quatre murs, carrelés sur 2 m
  for (const n of [1, 2, 3, 4]) await page.getByRole('checkbox', { name: new RegExp(`^Mur ${n} `) }).check();
  await page.getByRole('button', { name: 'Suivant' }).click();
  if (tile) {
    for (const [label, v] of [
      ['Longueur', tile[0]],
      ['Largeur', tile[1]],
    ] as const) {
      const f = page.getByLabel(label, { exact: true });
      await f.fill(String(v));
      await f.press('Enter');
    }
  }
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('heading', { name: /^Carrelage — / })).toBeVisible();
  return /#\/p\/([^/]+)/.exec(page.url())![1]!;
}

/** Attend une image rendue et renvoie les mesures de la scène 3D. */
export async function sceneStats(page: Page) {
  const box = page.getByRole('application', { name: /^(Vue 3D|Maquette 3D)/ });
  await expect(box).not.toHaveAttribute('data-draw-calls', '0', { timeout: 15000 });
  return {
    drawCalls: Number(await box.getAttribute('data-draw-calls')),
    triangles: Number(await box.getAttribute('data-triangles')),
    fps: Number(await box.getAttribute('data-fps')),
  };
}
