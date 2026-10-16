/**
 * Outils communs de l'audit UI/UX (docs/audit/). Un scénario ne s'arrête pas sur un constat : il le relève
 * (`au.note`), prend ses captures (`au.shot`) et ses mesures automatiques (`au.check`). Les relevés vont dans
 * docs/audit/captures-local/mesures/<scénario>/<appareil>.json, agrégés ensuite par `tests/audit/aggregate.ts`.
 */
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export { expect };

const ROOT = join(import.meta.dirname, '..', '..', 'docs', 'audit');
/** Appareils de référence : leurs captures sont versionnées (docs/audit/captures/). */
export const REFERENCE = ['tel-390x844-portrait-chromium', 'pc-1280x800-chromium'];

export interface CheckResult {
  url: string;
  axe: { id: string; impact: string | null; help: string; nodes: string[] }[];
  smallTargets: string[];
  overflowX: number;
  smallInputs: string[];
  clipped: string[];
}

export class Audit {
  readonly notes: Record<string, unknown> = {};
  readonly checks: Record<string, CheckResult> = {};
  constructor(
    private readonly page: Page,
    private readonly info: TestInfo,
  ) {}

  get device(): string {
    return this.info.project.name;
  }
  get scenario(): string {
    return /^([A-N]\d+)/.exec(this.info.title)?.[1] ?? 'X';
  }
  get isReference(): boolean {
    return REFERENCE.includes(this.device);
  }
  get isPhone(): boolean {
    return this.device.startsWith('tel-');
  }
  get isTouch(): boolean {
    return !this.device.startsWith('pc-');
  }
  get engine(): 'chromium' | 'webkit' | 'firefox' {
    return this.device.endsWith('webkit') ? 'webkit' : this.device.endsWith('firefox') ? 'firefox' : 'chromium';
  }
  /** Mise en page « ordinateur » de l'application (inspecteur à droite) : largeur ≥ 1024 px. */
  get isWide(): boolean {
    return (this.page.viewportSize()?.width ?? 0) >= 1024;
  }

  /** Capture JPEG pleine page : docs/audit/captures[-local]/<écran>/<appareil>/<scénario>-<étape>.jpg. */
  async shot(screen: string, step: string, opts: { full?: boolean } = {}): Promise<string> {
    const dir = this.isReference ? 'captures' : 'captures-local';
    const rel = `${dir}/${screen}/${this.device}/${this.scenario}-${step}.jpg`;
    const path = join(ROOT, rel);
    mkdirSync(dirname(path), { recursive: true });
    await this.page.evaluate(() => document.fonts.ready).catch(() => undefined);
    await this.page.screenshot({
      path,
      type: 'jpeg',
      quality: 70,
      fullPage: opts.full ?? true,
      animations: 'disabled',
    });
    return 'docs/audit/' + rel;
  }

  /** Relevé d'une observation (valeur sérialisable), écrit à la fin du test. */
  note(key: string, value: unknown): void {
    this.notes[key] = value;
  }

  /**
   * Mesures automatiques de l'écran affiché : axe-core (WCAG 2.2 A/AA), cibles < 44 px (ou `min`), défilement
   * horizontal, champs de saisie < 16 px (zoom iOS), textes coupés. Relevées, jamais bloquantes.
   */
  async check(screen: string, min = 44): Promise<CheckResult> {
    const page = this.page;
    await page
      .evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
      .catch(() => undefined);
    let axe: CheckResult['axe'];
    try {
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      axe = r.violations.map((v) => ({
        id: v.id,
        impact: v.impact ?? null,
        help: v.help,
        nodes: v.nodes.slice(0, 8).map((n) => n.target.join(' ')),
      }));
    } catch (e) {
      axe = [{ id: 'axe-error', impact: null, help: String(e), nodes: [] }];
    }
    const dom = await page.evaluate((min) => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const label = (el: Element) =>
        `${el.tagName.toLowerCase()} « ${(el.getAttribute('aria-label') || el.textContent || (el as HTMLInputElement).name || '').trim().replace(/\s+/g, ' ').slice(0, 40)} » ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`;
      const small = [
        ...document.querySelectorAll(
          'button, a[href], input:not([type=hidden]), select, textarea, [role=radio], [role=tab], [role=button]',
        ),
      ]
        .filter(visible)
        .filter((el) => {
          if (el.tagName === 'A' && el.closest('p, li > span')) return false;
          if (el.hasAttribute('data-stretched')) return false;
          let r = el.getBoundingClientRect();
          const lab = el.closest('label');
          if (el instanceof HTMLInputElement && lab) r = lab.getBoundingClientRect();
          return r.width < min - 0.5 || r.height < min - 0.5;
        })
        .map(label);
      const smallInputs = [
        ...document.querySelectorAll(
          'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]), select, textarea',
        ),
      ]
        .filter(visible)
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => `${label(el)} ${getComputedStyle(el).fontSize}`);
      const clipped = [...document.querySelectorAll('h1, h2, h3, button, a, label, p, span, td, th')]
        .filter(visible)
        .filter((el) => {
          const s = getComputedStyle(el);
          const cuts = s.overflow === 'hidden' || s.textOverflow === 'ellipsis' || s.overflowX === 'hidden';
          return cuts && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0;
        })
        .map(label)
        .slice(0, 20);
      return {
        smallTargets: small.slice(0, 40),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        smallInputs: smallInputs.slice(0, 20),
        clipped,
      };
    }, min);
    const res: CheckResult = { url: page.url().replace(/^https?:\/\/[^/]+/, ''), axe, ...dom };
    this.checks[screen] = res;
    return res;
  }

  /**
   * Étape qui peut échouer sans arrêter le scénario : l'échec est relevé (`échec:<étape>`, message et capture)
   * et l'étape renvoie null. Délai court : une action introuvable est un constat, pas une attente.
   */
  async step<T>(label: string, run: () => Promise<T>, screen = 'echecs'): Promise<T | null> {
    try {
      return await run();
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).split('\n').slice(0, 3).join(' ');
      let shot = '';
      try {
        shot = await this.shot(screen, `echec-${label.replace(/[^\w-]+/g, '_').slice(0, 40)}`);
      } catch {
        /* page fermée */
      }
      this.note(`échec:${label}`, { message: msg, capture: shot });
      return null;
    }
  }

  /** Écrit les relevés du test. */
  flush(status: string): void {
    const path = join(ROOT, 'captures-local', 'mesures', this.scenario, `${this.device}.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        { title: this.info.title, device: this.device, status, notes: this.notes, checks: this.checks },
        null,
        1,
      ),
    );
  }
}

export const test = base.extend<{ au: Audit }>({
  au: async ({ page }, use, info) => {
    const au = new Audit(page, info);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await use(au);
    if (errors.length) au.note('erreurs-console', [...new Set(errors)].slice(0, 20));
    au.flush(info.status ?? 'unknown');
  },
});

/* ---------- jeux de données ---------- */

interface Dump {
  stores: Record<string, { keyPath: boolean; rows: { key: unknown; value: unknown }[] }>;
}

/** Jeu de données figé (tests/audit/fixtures/<nom>.json), créé par `seed.spec.ts`. */
export function fixture(name: string): Dump {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', `${name}.json`), 'utf8')) as Dump;
}

/** Lit toute la base IndexedDB `pilepoil` de la page (sans les photos). */
export async function dumpDb(page: Page): Promise<Dump> {
  return page.evaluate(
    () =>
      new Promise<Dump>((resolve, reject) => {
        const open = indexedDB.open('pilepoil');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = [...db.objectStoreNames].filter((n) => n !== 'photos');
          const tx = db.transaction(names);
          const out: Dump = { stores: {} };
          for (const n of names) {
            const s = tx.objectStore(n);
            const keys = s.getAllKeys();
            const vals = s.getAll();
            vals.onsuccess = () => {
              out.stores[n] = {
                keyPath: s.keyPath != null,
                rows: (vals.result as unknown[]).map((value, i) => ({ key: keys.result[i], value })),
              };
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(out);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

/**
 * Remplace le contenu de la base par un jeu de données, puis recharge : la base est d'abord créée par
 * l'application elle-même (bon schéma), les magasins sont vidés et remplis. Attend l'accueil prêt.
 */
export async function seed(page: Page, data: Dump | string, then = '/#/', base = ''): Promise<void> {
  const dump = typeof data === 'string' ? fixture(data) : data;
  await page.goto(base + '/#/settings');
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(
    (dump) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('pilepoil');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = Object.keys(dump.stores).filter((n) => db.objectStoreNames.contains(n));
          const tx = db.transaction(names, 'readwrite');
          for (const n of names) {
            const s = tx.objectStore(n);
            s.clear();
            for (const r of dump.stores[n]!.rows)
              if (dump.stores[n]!.keyPath) s.put(r.value);
              else s.put(r.value, r.key as IDBValidKey);
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    dump,
  );
  await page.goto(then);
  await page.reload();
}

/** Identifiant du premier projet du jeu de données dont le nom vaut `name`. */
export function projectId(name: string, data = 'maison'): string {
  const rows = fixture(data).stores['projects']?.rows ?? [];
  const p = rows.map((r) => r.value as { id: string; name: string }).find((v) => v.name === name);
  if (!p) throw new Error(`Projet « ${name} » absent du jeu ${data}`);
  return p.id;
}

interface Maison {
  id: string;
  /** Pièces relevées (état des lieux) : nom → identifiant. */
  rooms: Record<string, string>;
  /** Poses dans l'ordre : parquet séjour, carrelage crédence, peinture au-dessus, peinture mur 3, carrelage sol SdB, carrelage murs SdB. */
  poses: { id: string; module: string; name: string }[];
  partition: string;
}

/** Identifiants du jeu « maison » (tests/audit/fixtures.setup.ts). */
export function maison(): Maison {
  const p = fixture('maison').stores['projects']!.rows[0]!.value as {
    id: string;
    poses: Maison['poses'];
    site: { existing: { rooms: { id: string; name: string }[] }; partitions: { id: string }[] };
  };
  return {
    id: p.id,
    rooms: Object.fromEntries(p.site.existing.rooms.map((r) => [r.name, r.id])),
    poses: p.poses,
    partition: p.site.partitions[0]!.id,
  };
}

/* ---------- gestes et saisies ---------- */

/** Panneau de réglages du plan ou du calepinage : à droite sur ordinateur, tiré du bas sur téléphone. */
export function panel(page: Page): Locator {
  return page
    .getByRole('complementary', { name: /^Réglages/ })
    .or(page.locator('.sheet'))
    .first();
}

/** Sur téléphone, ouvre le panneau tiré s'il est replié (ses réglages sont cachés tant qu'il est fermé). */
export async function openSheet(page: Page): Promise<void> {
  await panel(page)
    .waitFor({ state: 'attached', timeout: 15_000 })
    .catch(() => undefined);
  const h = page.locator('.sheet > button.handle').first();
  if ((await h.count()) && (await h.getAttribute('aria-expanded')) === 'false') {
    await h.click();
    await page.waitForTimeout(400);
  }
}

/** Saisit un texte dans un champ (par libellé) et le valide par Entrée ; renvoie la valeur affichée ensuite. */
export async function typeIn(scope: Page | Locator, label: string | RegExp, value: string): Promise<string> {
  const f = scope.getByLabel(label, { exact: typeof label === 'string' }).first();
  await f.fill(value);
  await f.press('Enter');
  await f.page().waitForTimeout(150);
  return f.inputValue().catch(() => '');
}

/** Toucher (tactile) ou cliquer selon l'appareil. */
export async function tap(page: Page, x: number, y: number, touch: boolean): Promise<void> {
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Texte de chaque page d'un PDF (pdfjs, sous Node). */
export async function pdfText(path: string, max = 2000): Promise<string[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pages.push(
      c.items
        .map((x) => ('str' in x ? x.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .slice(0, max),
    );
  }
  return pages;
}

/** Durée d'une action (ms). */
export async function timed(run: () => Promise<unknown>): Promise<number> {
  const t = performance.now();
  await run();
  return Math.round(performance.now() - t);
}
