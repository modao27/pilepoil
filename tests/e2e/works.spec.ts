import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  addTile,
  cover,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  openRoom,
  shot,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

async function setNumber(scope: Locator, label: string, value: string) {
  const f = scope.getByLabel(label, { exact: true });
  await f.fill(value);
  await f.press('Enter');
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));

/** Nouveau projet « Maison » avec un séjour rectangulaire de 6 × 4 m. */
async function newHouse(page: Page) {
  await page.goto('/#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await setNumber(dialog, 'Nom du projet', 'Maison');
  await dialog.getByRole('radio', { name: 'Rectangle' }).click();
  await setNumber(dialog, 'Nom', 'Séjour');
  await setNumber(dialog, 'Longueur', '600');
  await setNumber(dialog, 'Largeur', '400');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  await expect(panel(page).getByRole('heading', { name: 'Séjour' })).toBeVisible();
}

const layer = (page: Page, name: 'État des lieux' | 'Travaux') => panel(page).getByRole('radio', { name }).click();

test('travaux : verrouiller les murs, tracer une cloison avec une porte, annuler, retrouver', async ({
  page,
}, info) => {
  await newHouse(page);
  const p = panel(page);
  await p.getByRole('button', { name: 'Toutes les pièces' }).click();
  await p.getByRole('button', { name: 'Verrouiller les murs extérieurs' }).click();
  await expect(page.getByText(/4 murs verrouillés comme extérieurs/)).toBeVisible();
  await expect(page.locator('g.lock')).toHaveCount(4);

  await layer(page, 'Travaux');
  await expect(page.getByRole('application', { name: /calque travaux/ })).toBeVisible();
  await p.getByRole('button', { name: 'Tracer une cloison' }).click();
  await expect(page.getByRole('application', { name: /tracé d’une cloison/ })).toBeVisible();

  // d'un mur à l'autre, au milieu du séjour : les deux points s'aimantent aux faces des murs
  const box = (await page.locator('polygon.floor').first().boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + 3);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 3);
  // la cloison sépare la pièce : la nouvelle pièce se nomme tout de suite
  const naming = page.getByRole('dialog', { name: 'Nommer la nouvelle pièce' });
  await expect(naming.getByLabel('Nom de la pièce')).toHaveValue(/\(2\)$/);
  await naming.getByLabel('Nom de la pièce').fill('Salon');
  await naming.getByRole('button', { name: 'Valider' }).click();
  await expect(page.locator('text.name', { hasText: 'Salon' })).toHaveCount(1);
  await expect(p.getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await expect(p.getByText(/Longueur 400 cm|Longueur 399,9 cm|Longueur 400,1 cm/)).toBeVisible();
  await shot(page, info, '70-travaux-cloison');

  // une porte dans la cloison : une porte par face et un passage
  await p.getByRole('button', { name: 'Ajouter une porte' }).click();
  await expect(p.getByText('Porte 1')).toBeVisible();
  await expect(page.locator('line.passage')).toHaveCount(1);
  await check(page);
  await shot(page, info, '71-travaux-porte');

  // tout est annulable : porte, nom, puis cloison
  const undo = page.locator('button[aria-label="Annuler"]');
  await undo.click();
  await expect(page.locator('line.passage')).toHaveCount(0);
  await undo.click();
  await expect(page.locator('text.name', { hasText: 'Salon' })).toHaveCount(0);
  await undo.click();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();
  const redo = page.getByRole('button', { name: 'Rétablir' });
  await redo.click();
  await redo.click();
  await redo.click();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await expect(page.locator('text.name', { hasText: 'Salon' })).toHaveCount(1);

  // enregistré : retrouvé après rechargement
  await page.reload();
  await layer(page, 'Travaux');
  await expect(p.getByRole('button', { name: /^Cloison 1/ })).toBeVisible();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await expect(page.locator('text.name', { hasText: 'Salon' })).toHaveCount(1);
  // l'état des lieux n'a pas changé
  await layer(page, 'État des lieux');
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();
});

test('travaux : démolir un mur fusionne deux pièces, un mur verrouillé est refusé', async ({ page }, info) => {
  await newHouse(page);
  const p = panel(page);
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  const dialog = page.getByRole('dialog', { name: /^(Nouveau projet|Ajouter une pièce)$/ });
  await dialog.getByRole('radio', { name: 'Rectangle' }).click();
  await setNumber(dialog, 'Nom', 'Chambre');
  await setNumber(dialog, 'Longueur', '300');
  await setNumber(dialog, 'Largeur', '400');
  await dialog.getByLabel('Emplacement').selectOption({ label: 'Contre Séjour, mur 2' });
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(p.getByRole('heading', { name: 'Chambre' })).toBeVisible();
  await p.getByRole('button', { name: 'Toutes les pièces' }).click();
  await p.getByRole('button', { name: 'Verrouiller les murs extérieurs' }).click();
  await expect(page.getByText(/6 murs verrouillés comme extérieurs/)).toBeVisible();

  await layer(page, 'Travaux');
  await p.getByRole('button', { name: 'Démolir un mur' }).click();
  await expect(page.getByRole('application', { name: /choix du mur à démolir/ })).toBeVisible();
  // un mur extérieur : refusé, avec la raison
  await page.locator('polygon.xwall.locked').first().click();
  await expect(page.getByText(/mur extérieur, verrouillé/)).toBeVisible();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();

  // le mur mitoyen : les deux pièces fusionnent
  // les deux faces du mur mitoyen se superposent : on touche celle du dessus
  await page.locator('polygon.xwall:not(.locked)').last().click();
  await expect(p.getByRole('heading', { name: /^Démolition — (Séjour|Chambre), mur/ })).toBeVisible();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();
  await check(page);
  await shot(page, info, '72-travaux-demolition');

  // supprimer la démolition rétablit le mur
  await p.getByRole('button', { name: 'Supprimer la démolition' }).click();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
});

test('travaux : la face d’une cloison neuve se carrèle comme un mur, avec le sol rogné', async ({ page }) => {
  await addTile(page);
  await newHouse(page);
  const p = panel(page);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await layer(page, 'Travaux');
  await p.getByRole('button', { name: 'Tracer une cloison' }).click();
  const box = (await page.locator('polygon.floor').first().boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + 3);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 3);
  await expect(p.getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).first().waitFor();

  // la pièce après travaux a ses propres murs, dont la face de la cloison : tous se carrèlent
  await openRoom(page, id, 'Séjour (2)');
  await cover(page, 'Sol');
  for (const n of [1, 2, 3, 4]) await cover(page, `Mur ${n}`, 'carrelage', n > 1 ? 'new' : undefined);
  await expect(
    page.getByRole('region', { name: 'Sol et murs' }).getByRole('button', { name: /^(Sol|Mur \d) .*Pose \d/ }),
  ).toHaveCount(5);

  // retirer la cloison : la pièce d'origine retrouve son sol entier, le sol carrelé de la pièce (2) n'est plus compté
  await page.goto(`/#/p/${id}/plan`);
  await layer(page, 'Travaux');
  await p.getByRole('button', { name: /^Cloison 1/ }).click();
  await p.getByRole('button', { name: 'Supprimer la cloison' }).click();
  // la pièce (2) disparaît avec ses revêtements : confirmation qui détaille la perte, rien n'est supprimé avant
  const loss = page.getByRole('dialog', { name: 'Des revêtements seront réduits' });
  await expect(loss.getByText(/Carrelage, « Pose \d » : −/).first()).toBeVisible();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await loss.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();
});
