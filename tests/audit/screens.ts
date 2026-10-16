/** Écrans parcourus par le tour (N1 à N4), sur le jeu « maison ». */
import type { Page } from '@playwright/test';
import { maison } from './audit';

export interface ScreenDef {
  /** Dossier des captures. */
  key: string;
  url: string;
  /** 3D ou calcul : attente plus longue. */
  heavy?: boolean;
}

export function screens(): ScreenDef[] {
  const m = maison();
  const p = `/#/p/${m.id}`;
  const [parquet, credence, peintureHaut, peintureMur3, solSdb, mursSdb] = m.poses;
  const seen: ScreenDef[] = [
    { key: 'accueil', url: '/#/' },
    { key: 'projet', url: p, heavy: true },
    { key: 'plan', url: `${p}/plan` },
    { key: 'vue-3d', url: `${p}/3d`, heavy: true },
    { key: 'piece', url: `${p}/r/${m.rooms['Séjour']}` },
    { key: 'piece-sol', url: `${p}/r/${m.rooms['Salle de bain']}/sol` },
    { key: 'calepinage-carrelage', url: `#${solSdb!.id}`, heavy: true },
    { key: 'calepinage-carrelage-murs', url: `#${mursSdb!.id}`, heavy: true },
    { key: 'calepinage-carrelage-credence', url: `#${credence!.id}`, heavy: true },
    { key: 'calepinage-parquet', url: `${p}/m/parquet/pose/${parquet!.id}`, heavy: true },
    { key: 'pose-peinture', url: `${p}/m/peinture/pose/${peintureHaut!.id}`, heavy: true },
    { key: 'pose-peinture-mur', url: `${p}/m/peinture/pose/${peintureMur3!.id}`, heavy: true },
    { key: 'cloisons', url: `${p}/m/cloisons`, heavy: true },
    { key: 'cloison-elevation', url: `${p}/m/cloisons/c/${m.partition}`, heavy: true },
    { key: 'comparer', url: `${p}/m/carrelage/compare`, heavy: true },
    { key: 'resultats-projet', url: `${p}/resultats`, heavy: true },
    { key: 'resultats-piece', url: `${p}/r/${m.rooms['Salle de bain']}/resultats`, heavy: true },
    { key: 'resultats-pose', url: `${p}/pose/${solSdb!.id}/resultats`, heavy: true },
    { key: 'achats', url: `${p}/achats`, heavy: true },
    { key: 'biblio-carreaux', url: '/#/library/tiles' },
    { key: 'biblio-lames', url: '/#/library/boards' },
    { key: 'biblio-peintures', url: '/#/library/paints' },
    { key: 'biblio-cloisons', url: '/#/library/systems' },
    { key: 'fiche-carreau', url: '/#/library/tiles/modele-gres-60x60' },
    { key: 'fiche-lame', url: '/#/library/boards/modele-stratifie' },
    { key: 'fiche-peinture', url: '/#/library/paints/modele-blanc-mat' },
    { key: 'fiche-cloison', url: '/#/library/systems/modele-72-48' },
    { key: 'fiche-carreau-nouveau', url: '/#/library/tiles/new' },
    { key: 'reglages', url: '/#/settings' },
    { key: 'importer', url: '/#/import' },
    { key: 'design', url: '/#/demo' },
    { key: 'introuvable', url: '/#/nimporte/quoi' },
    { key: 'nouveau-projet', url: '/#/new' },
  ];
  // les poses carrelage s'ouvrent par leur adresse de module
  return seen.map((s) => (s.url.startsWith('#') ? { ...s, url: `${p}/m/carrelage/s/${s.url.slice(1)}` } : s));
}

/** Ouvre un écran et attend qu'il soit affiché (plus de « Chargement… », calculs lancés). */
export async function open(page: Page, s: ScreenDef): Promise<void> {
  await page.goto(s.url);
  await page
    .getByText('Chargement…', { exact: true })
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => undefined);
  await page
    .locator('h1')
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(s.heavy ? 2500 : 600);
}
