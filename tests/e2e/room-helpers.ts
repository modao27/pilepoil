import { expect, type Page } from '@playwright/test';
import { addTile, cover, fillNumber, openRoom, planRoom } from './helpers';

/**
 * Pièce de 15 m² (4 × 3,75 m, 2,50 m sous plafond), sol et quatre murs carrelés (une pose chacun), par le
 * parcours normal ; `tile` : longueur et largeur du carreau ajouté (mm). Reste sur l'écran Pièce.
 */
export async function newRoom(page: Page, tile?: [number, number]): Promise<string> {
  await addTile(page, async () => {
    if (!tile) return;
    await fillNumber(page, 'Longueur', String(tile[0]));
    await fillNumber(page, 'Largeur', String(tile[1]));
  });
  const id = await planRoom(page, 'Pièce 400 × 375', [400, 375], 250);
  await openRoom(page, id);
  await cover(page, 'Sol');
  for (const n of [1, 2, 3, 4]) await cover(page, `Mur ${n}`, 'carrelage', n > 1 ? 'new' : undefined);
  await expect(
    page.getByRole('region', { name: 'Sol et murs' }).getByRole('button', { name: /^(Sol|Mur \d) .*Pose \d/ }),
  ).toHaveCount(5);
  return id;
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
