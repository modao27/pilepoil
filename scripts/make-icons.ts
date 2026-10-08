/**
 * Produit les icônes de public/ à partir de src/pwa/icon.ts (rendu des PNG par Chromium).
 * Usage : npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';
import { ICON_FILES, iconSvg } from '../src/pwa/icon';

const out = join(import.meta.dirname, '..', 'public');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f of ICON_FILES) {
  const file = join(out, f.name);
  mkdirSync(dirname(file), { recursive: true });
  const svg = iconSvg(f.options);
  if (f.type === 'svg') {
    writeFileSync(file, svg + '\n');
  } else {
    const { size } = f.options;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
    await page.locator('svg').screenshot({ path: file, omitBackground: true });
  }
  console.log(f.name);
}
await browser.close();
