import { expect, test } from '@playwright/test';
import { newRoom, sceneStats } from './room-helpers';

// GPU réel si disponible (sinon Chromium rend en logiciel, sans rapport avec un téléphone).
test.use({ launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] } });

test('pièce de 15 m² en 10 × 10 : budget de dessin et images par seconde en rotation', async ({ page }, info) => {
  test.setTimeout(90_000);
  // 4 × 3,75 m, carreaux de 10 × 10 cm : environ 4 900 pièces sur les murs et le sol
  await newRoom(page, [100, 100]);
  // fenêtre à tableaux et baignoire sur le mur A : embrasure et ombres portées
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Ouvertures' }).click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const depth = page.getByLabel('Profondeur du tableau', { exact: true });
  await depth.fill('20');
  await depth.press('Enter');
  await page.getByLabel('Type à ajouter').selectOption({ label: 'Baignoire, receveur' });
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForTimeout(500);

  const id = /#\/p\/([^/]+)/.exec(page.url())![1];
  await page.goto(`/#/p/${id}/m/carrelage/room`);
  await page.getByRole('radio', { name: '3D' }).click();
  await sceneStats(page);
  await page.getByRole('button', { name: 'Faire tourner' }).click();
  await page.waitForTimeout(3000);
  const st = await sceneStats(page);
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.screenshot({ path: `screenshots/${info.project.name}/86-perf-piece-10x10.png` });

  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'inconnu';
  });
  info.annotations.push({ type: 'perf', description: `${JSON.stringify(st)} sur ${renderer}` });
  console.log(`[perf 3D ${info.project.name}] ${JSON.stringify(st)} — ${renderer}`);
  expect(st.drawCalls).toBeLessThanOrEqual(40);
  expect(st.triangles).toBeLessThanOrEqual(200_000);
  expect(st.fps).toBeGreaterThan(0);
});
