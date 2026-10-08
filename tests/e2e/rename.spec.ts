import { expect, test } from '@playwright/test';
import { V1_ROOM } from '../unit/fixtures/v1';

/**
 * Un projet créé sous l'ancien nom (base IndexedDB « calepinage », même origine) se retrouve dans Pilepoil
 * après la mise à jour : copie unique au premier lancement, message pour désinstaller l'ancienne appli.
 */
test('projet de l’ancienne appli Calepinage retrouvé après le renommage', async ({ page }) => {
  // base de l'ancienne appli (schéma v1 publié), sur la même origine, avant le premier lancement de Pilepoil
  await page.goto('/robots.txt');
  await page.evaluate(
    (project) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('calepinage', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('projects', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
          const tiles = db.createObjectStore('tiles', { keyPath: 'id' });
          tiles.createIndex('name', 'name');
          tiles.createIndex('updatedAt', 'updatedAt');
          db.createObjectStore('photos', { keyPath: 'id' });
          db.createObjectStore('scenarios', { keyPath: 'id' }).createIndex('projectId', 'projectId');
          db.createObjectStore('prefs', { keyPath: 'key' });
        };
        req.onsuccess = () => {
          const tx = req.result.transaction(['projects', 'prefs'], 'readwrite');
          tx.objectStore('projects').put(project);
          // import legacy déjà fait dans l'ancienne appli : il ne doit pas se refaire
          tx.objectStore('prefs').put({ key: 'legacyImport', value: { at: 1, projectId: null } });
          tx.oncomplete = () => (req.result.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    structuredClone(V1_ROOM),
  );

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Salle de bain' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /ancienne appli Calepinage sont ici/ })).toBeVisible();
  await expect(page).toHaveTitle('Pilepoil');

  // le projet s'ouvre (migré en v2 : pièce du plan créée depuis la pièce carrelage)
  await page.getByRole('link', { name: 'Salle de bain' }).click();
  await expect(page.getByRole('link', { name: /1 pièce/ })).toBeVisible();

  // pas de seconde copie ; l'ancienne base est intacte
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: /ancienne appli Calepinage/ })).toHaveCount(0);
  const old = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('calepinage');
        req.onsuccess = () => {
          const db = req.result;
          const c = db.transaction('projects').objectStore('projects').count();
          c.onsuccess = () => (db.close(), resolve(c.result));
        };
      }),
  );
  expect(old).toBe(1);
  await page.goto('/#/settings');
  await expect(page.getByText(/Vos projets de l’ancienne appli Calepinage ont été repris ici/)).toBeVisible();
});
