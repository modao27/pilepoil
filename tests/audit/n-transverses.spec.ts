/**
 * N. Scénarios transverses : tour des écrans (captures, axe-core, cibles, débordements, champs < 16 px) en clair
 * et en sombre ; clavier seul ; zoom 200 % et texte agrandi ; mouvement réduit.
 */
import { seed, test } from './audit';
import { open, screens } from './screens';

test.describe.configure({ timeout: 600_000 });

test('N1 tour des écrans, clair et sombre', async ({ page, au }) => {
  await seed(page, 'maison');
  const ls = screens();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const s of ls) {
      await open(page, s);
      await au.shot(s.key, theme);
      const c = await au.check(`${s.key}:${theme}`);
      if (theme === 'light') {
        // titre de page et nombre de titres h1 (repère pour lecteurs d'écran)
        au.note(`${s.key}:title`, await page.title());
        au.note(`${s.key}:h1`, await page.locator('h1').allInnerTexts());
      }
      void c;
    }
  }
});

test('N2 clavier seul : ordre de tabulation, focus visible, pièges', async ({ page, au }) => {
  await seed(page, 'maison');
  const keys = [
    'accueil',
    'projet',
    'plan',
    'piece',
    'calepinage-carrelage',
    'calepinage-parquet',
    'pose-peinture',
    'cloisons',
    'resultats-projet',
    'achats',
    'biblio-carreaux',
    'fiche-lame',
    'reglages',
    'nouveau-projet',
  ];
  for (const s of screens().filter((x) => keys.includes(x.key))) {
    await open(page, s);
    await page
      .locator('body')
      .click({ position: { x: 1, y: 1 } })
      .catch(() => undefined);
    const seen: string[] = [];
    const invisible: string[] = [];
    let stuck = 0;
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const ring =
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
          (s.boxShadow !== 'none' && s.boxShadow !== '') ||
          el.matches(':focus-visible') === false;
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName)
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40);
        return {
          id: `${el.tagName.toLowerCase()} « ${name} »`,
          ring,
          offscreen: r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth,
        };
      });
      if (!f) continue;
      if (seen.at(-1) === f.id) stuck++;
      seen.push(f.id);
      if (!f.ring) invisible.push(f.id);
      if (f.offscreen) invisible.push(`${f.id} (hors écran)`);
      if (seen.length > 3 && seen.at(-1) === seen[0]) break;
    }
    if (s.key === 'plan' || s.key === 'accueil' || s.key === 'calepinage-carrelage') await au.shot(s.key, 'focus');
    au.note(`${s.key}:tab`, {
      order: seen.slice(0, 40),
      sansFocusVisible: [...new Set(invisible)],
      repetitions: stuck,
    });
  }
});

test('N3 zoom 200 % (reflow) et texte agrandi à 200 %', async ({ page, au }) => {
  await seed(page, 'maison');
  const vp = page.viewportSize()!;
  const keys = [
    'accueil',
    'projet',
    'plan',
    'piece',
    'calepinage-carrelage',
    'resultats-projet',
    'achats',
    'fiche-carreau',
    'reglages',
    'nouveau-projet',
  ];
  const list = screens().filter((x) => keys.includes(x.key));
  // zoom navigateur 200 % : même mise en page qu'une fenêtre deux fois plus petite (WCAG 1.4.10 : 320 px)
  await page.setViewportSize({
    width: Math.max(320, Math.round(vp.width / 2)),
    height: Math.max(256, Math.round(vp.height / 2)),
  });
  for (const s of list) {
    await open(page, s);
    await au.shot(s.key, 'zoom200');
    const c = await au.check(`${s.key}:zoom200`);
    au.note(`${s.key}:zoom200`, { overflowX: c.overflowX, clipped: c.clipped });
  }
  await page.setViewportSize(vp);
  // texte seul à 200 % (WCAG 1.4.4) : taille de police de base doublée
  for (const s of list) {
    await open(page, s);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.waitForTimeout(300);
    await au.shot(s.key, 'texte200');
    const c = await au.check(`${s.key}:texte200`);
    au.note(`${s.key}:texte200`, {
      overflowX: c.overflowX,
      clipped: c.clipped,
      rootPx: await page.evaluate(() => getComputedStyle(document.body).fontSize),
    });
  }
});

test('N4 mouvement réduit : animations et transitions', async ({ page, au }) => {
  await seed(page, 'maison');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const keys = ['accueil', 'plan', 'piece', 'calepinage-carrelage', 'resultats-projet', 'vue-3d'];
  for (const s of screens().filter((x) => keys.includes(x.key))) {
    await open(page, s);
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map((el) => {
          const st = getComputedStyle(el);
          const d = (v: string) => Math.max(...v.split(',').map((x) => parseFloat(x) * (x.includes('ms') ? 0.001 : 1)));
          return { el, t: d(st.transitionDuration), a: st.animationName !== 'none' ? d(st.animationDuration) : 0 };
        })
        .filter((x) => x.t > 0.02 || x.a > 0.02)
        .map((x) => `${x.el.tagName.toLowerCase()}.${[...x.el.classList].join('.')} t=${x.t}s a=${x.a}s`)
        .slice(0, 20),
    );
    au.note(`${s.key}:mouvement`, moving);
  }
  // panneau tiré et toast : transitions observées pendant une action
  if (au.isPhone) {
    await open(
      page,
      screens().find((x) => x.key === 'plan')!,
    );
    await au.shot('plan', 'reduit');
  }
});
