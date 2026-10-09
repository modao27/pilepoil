import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * Projet vide (plan sans pièce) avec un outil sans assistant (parquet), créé depuis « Nouveau projet » : l'éditeur
 * de plan s'ouvre. Renvoie l'identifiant du projet.
 */
export async function emptyProject(page: Page, tool = 'parquet'): Promise<string> {
  await page.goto('/#/new');
  await page.getByRole('button', { name: `Commencer : ${tool}` }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  return /#\/p\/([^/]+)/.exec(page.url())![1]!;
}

/** Saisit un nombre (ou un texte) et le valide (Entrée). */
export async function fillNumber(scope: Page | Locator, label: string, value: string): Promise<void> {
  const f = scope.getByLabel(label, { exact: true });
  await f.fill(value);
  await f.press('Enter');
}

/**
 * Carreau ajouté à la bibliothèque (#/library/tiles/new) : `fill` complète le formulaire (par défaut, le carreau
 * proposé, 60 × 30 cm).
 */
export async function addTile(page: Page, fill?: () => Promise<void>, base = '/'): Promise<void> {
  await page.goto(`${base}#/library/tiles/new`);
  if (fill) await fill();
  await page.getByRole('button', { name: 'Ajouter le carreau' }).click();
  await expect(page).toHaveURL(/#\/library\/tiles$/);
}

/**
 * Projet carrelage « Pièce 300 × 240 » créé par le parcours normal : nouveau projet, pièce « Pièce » de
 * 300 × 240 cm dessinée sur le plan, 240 cm sous plafond, mur 1 coché sur l'écran Carrelage, puis son éditeur.
 * `tile` : saisie du carreau ajouté d'abord à la bibliothèque (undefined : le carreau proposé ; null : aucun
 * ajout, le premier de la bibliothèque sert). Renvoie l'identifiant du projet.
 */
export async function newWall(page: Page, tile?: (() => Promise<void>) | null, base = '/'): Promise<string> {
  if (tile !== null) await addTile(page, tile, base);
  const id = await planRoom(page, 'Pièce 300 × 240', [300, 240], 240, base);
  await page.goto(`${base}#/p/${id}/m/carrelage`);
  await expect(page.getByRole('heading', { name: /^Carrelage — / })).toBeVisible();
  await page.getByRole('checkbox', { name: /^Mur 1 / }).check();
  await page.getByRole('link', { name: 'Ouvrir Pièce, mur 1' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
  return id;
}

/**
 * Nouveau projet carrelage nommé `name`, avec une pièce « Pièce » de `size` cm (longueur × largeur) dessinée sur
 * le plan et `height` cm sous plafond. Renvoie l'identifiant du projet.
 */
export async function planRoom(
  page: Page,
  name: string,
  size: [number, number],
  height: number,
  base = '/',
): Promise<string> {
  await page.goto(`${base}#/new`);
  await page.getByLabel('Nom du projet', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Commencer : carrelage' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await fillNumber(dialog, 'Nom', 'Pièce');
  await fillNumber(dialog, 'Longueur', String(size[0]));
  await fillNumber(dialog, 'Largeur', String(size[1]));
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await expect(panel.getByRole('heading', { name: 'Pièce' })).toBeVisible();
  await fillNumber(panel, 'Hauteur sous plafond', String(height));
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();
  return id;
}

/**
 * Ajoute une fenêtre (valeurs par défaut) sur le premier mur de la pièce `room` dans l'éditeur de plan, puis
 * ouvre l'éditeur du carrelage sur ce mur.
 */
export async function addPlanWindow(page: Page, id: string, room = 'Pièce'): Promise<void> {
  await page.goto(`/#/p/${id}/plan`);
  const p = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await p.getByRole('button', { name: room, exact: true }).click();
  await p
    .getByRole('button', { name: /^Ouvertures et épaisseur/ })
    .first()
    .click();
  await p.getByRole('button', { name: 'Ajouter une fenêtre' }).click();
  await expect(p.getByRole('heading', { name: `Fenêtre — ${room}` })).toBeVisible();
  await page.goto(`/#/p/${id}/m/carrelage`);
  await page.getByRole('link', { name: `Ouvrir ${room}, mur 1` }).click();
  await expect(page.getByRole('application', { name: new RegExp(`^Plan de ${room}, mur 1`) })).toBeVisible();
}

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
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
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
        // lien étiré sur toute sa carte (::after) : la cible réelle est la carte
        if (el.hasAttribute('data-stretched')) {
          const card = el.closest('article')?.getBoundingClientRect();
          return !card || card.height < 43.5;
        }
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'file' || el.type === 'color'))
          return false;
        // bouton radio dans une étiquette : la cible réelle est l'étiquette entière
        if (el instanceof HTMLInputElement && el.type === 'radio' && el.closest('label')) {
          const l = el.closest('label')!.getBoundingClientRect();
          return l.width < 43.5 || l.height < 43.5;
        }
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
