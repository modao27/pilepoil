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

test('parquet : 30 m² en point de Hongrie, budget de dessin et images par seconde en rotation', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  // projet, pièce de 6 × 5 m dans le plan, parquet
  await page.goto('/#/new/carrelage');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await page.goto(`/#/p/${id}/plan`);
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  for (const [label, value] of [
    ['Nom', 'Salon'],
    ['Longueur', '600'],
    ['Largeur', '500'],
  ]) {
    const f = dialog.getByLabel(label!, { exact: true });
    await f.fill(value!);
    await f.press('Enter');
  }
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByRole('link', { name: 'Projet' }).click();
  await page.getByRole('button', { name: 'Ajouter parquet' }).click();
  const p = page.getByRole('complementary', { name: 'Réglages du parquet' }).or(page.locator('.sheet'));
  await p.getByRole('combobox', { name: 'Lame' }).selectOption({ label: 'Point de Hongrie 45° 600 × 90 (lames A/B)' });
  await p.getByRole('radio', { name: 'Hongrie' }).click();
  await expect(page.getByRole('link', { name: /lames · \d+ paquets/ }).first()).toBeVisible();

  await page.goto(`/#/p/${id}/m/parquet/results`);
  await page.getByRole('tab', { name: '3D' }).click();
  await sceneStats(page);
  await page.getByRole('button', { name: 'Faire tourner' }).click();
  await page.waitForTimeout(3000);
  const st = await sceneStats(page);
  await page.getByRole('button', { name: 'Arrêter' }).click();
  await page.screenshot({ path: `screenshots/${info.project.name}/87-parquet-3d-hongrie.png` });
  info.annotations.push({ type: 'perf', description: JSON.stringify(st) });
  console.log(`[perf 3D parquet ${info.project.name}] ${JSON.stringify(st)}`);
  expect(st.drawCalls).toBeLessThanOrEqual(40);
  expect(st.triangles).toBeLessThanOrEqual(200_000);
  expect(st.fps).toBeGreaterThan(0);
});
