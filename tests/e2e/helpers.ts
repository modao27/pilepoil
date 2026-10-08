import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** Capture pleine page dans screenshots/<profil>/<nom>.png (non versionné). */
export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `screenshots/${info.project.name}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

/** Aucune violation WCAG 2 A / AA détectée par axe (contrastes compris). */
export async function expectAccessible(page: Page): Promise<void> {
  // couleurs mesurées après les transitions (changement de thème, survol)
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = r.violations.map(
    (v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

/** Toutes les cibles tactiles visibles font au moins 44 × 44 px (sauf liens dans le texte). */
export async function expectTouchTargets(page: Page): Promise<void> {
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type=hidden]), select, textarea, [role=radio], [role=tab]',
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return false;
        if (el.tagName === 'A' && el.closest('p')) return false;
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'file' || el.type === 'color'))
          return false;
        return r.width < 43.5 || r.height < 43.5;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} « ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)} » ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
      ),
  );
  expect(small, small.join('\n')).toEqual([]);
}

/** Pas de défilement horizontal de la page. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}
