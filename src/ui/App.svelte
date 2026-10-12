<script lang="ts">
  import Button from './components/Button.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Screen from './components/Screen.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import { libraryById, loadModules, moduleById, modulesLoaded } from '../modules/registry';
  import LibraryNav from './components/LibraryNav.svelte';
  import { app } from './lib/app.svelte';
  import { matchScreen } from './lib/moduleRoutes';
  import { newProject } from './lib/newProject';
  import { router } from './lib/router.svelte';
  import type { Project as ProjectDoc } from '../state/model';
  import Home from './screens/Home.svelte';

  const route = $derived(router.route);
  /** Assistant de création d'un outil (#/new/<module>). */
  const creator = $derived(route.name === 'new' && route.module ? moduleById(route.module) : undefined);
  const screen = $derived.by(() => {
    if (route.name !== 'module') return null;
    const m = moduleById(route.module);
    return m ? matchScreen(m.screens, route.path) : null;
  });
  // séparés : changer de paramètre (autre surface) ne recharge pas l'écran
  const load = $derived(screen?.load);

  /**
   * Plan : celui d'un projet enregistré, ou d'un projet neuf (#/new) gardé en mémoire jusqu'à sa première pièce.
   * L'éditeur reste le même quand l'adresse passe de #/new à celle du plan (même identifiant).
   */
  let fresh: ProjectDoc | null = null;
  const planDoc = $derived.by((): { project: ProjectDoc; isNew: boolean } | null => {
    if (route.name === 'new' && !route.module) {
      if (!fresh || app.project(fresh.id)) fresh = newProject();
      return { project: fresh, isNew: true };
    }
    if (route.name !== 'plan') return null;
    const p = app.project(route.id) ?? (fresh?.id === route.id ? fresh : undefined);
    return p ? { project: p, isNew: false } : null;
  });
  const params = $derived(screen?.params ?? {});

  /**
   * Logique des modules (réducteurs, entrée moteur, achats) : hors du premier chargement. Les écrans d'un projet
   * l'attendent ; l'accueil, les bibliothèques et les réglages s'affichent sans elle. Elle est chargée dès que
   * l'écran affiché en a besoin, sinon quand le navigateur est libre.
   */
  let logicReady = $state(modulesLoaded());
  const needsLogic = $derived(!['home', 'library', 'libraryItem', 'settings', 'notFound'].includes(route.name));
  const loadLogic = () =>
    void loadModules().then(
      () => (logicReady = true),
      () => (app.fatal = 'Une partie de l’application n’a pas pu se charger. Rechargez la page.'),
    );
  /** Écran de la route, chargé en même temps que la logique (pas l'un après l'autre). */
  function prefetchScreen() {
    const n = route.name;
    if (n === 'plan' || (n === 'new' && !route.module)) void import('./plan/PlanEditor.svelte');
    else if (n === 'project') void import('./screens/Project.svelte');
    else if (n === 'room') void import('./screens/Room.svelte');
    else if (n === 'results') void import('./screens/Results.svelte');
    else if (n === 'model3d') void import('./screens/Project3D.svelte');
    else if (n === 'shopping') void import('./screens/Shopping.svelte');
    else void load?.();
  }
  $effect(() => {
    if (!app.ready || logicReady) return;
    if (needsLogic) {
      prefetchScreen();
      loadLogic();
    } else if ('requestIdleCallback' in window) requestIdleCallback(loadLogic, { timeout: 4000 });
    else setTimeout(loadLogic, 2000);
  });
</script>

{#snippet libraryNav()}<LibraryNav current={route.name === 'library' ? route.lib : ''} />{/snippet}

{#if app.fatal}
  <Screen title="PilePoil">
    <EmptyState icon="warn" title="Impossible d’ouvrir vos données" text={app.fatal} />
  </Screen>
{:else if !app.ready || (needsLogic && !logicReady)}
  <p class="loading" role="status">Chargement…</p>
{:else if route.name === 'home'}
  <Home />
{:else if planDoc}
  {#key planDoc.project.id}{#await import('./plan/PlanEditor.svelte') then { default: PlanEditor }}<PlanEditor
        project={planDoc.project}
        isNew={planDoc.isNew}
      />{/await}{/key}
{:else if route.name === 'new'}
  {#await creator?.screens.create?.() then Create}{#if Create}<Create />{/if}{/await}
{:else if route.name === 'library'}
  {#await libraryById(route.lib)?.screens.list() then LibraryList}{#if LibraryList}<LibraryList
        itemId={null}
        nav={libraryNav}
      />{/if}{/await}
{:else if route.name === 'libraryItem'}
  {#key route.lib + '/' + route.id}{#await libraryById(route.lib)?.screens.edit() then LibraryEdit}{#if LibraryEdit}<LibraryEdit
          itemId={route.id}
        />{/if}{/await}{/key}
{:else if route.name === 'settings'}
  {#await import('./screens/Settings.svelte') then { default: Settings }}<Settings />{/await}
{:else if route.name === 'demo'}
  {#await import('./screens/Demo.svelte') then { default: Demo }}<Demo />{/await}
{:else if route.name === 'room'}
  {#key route.id + '/' + route.room}{#await import('./screens/Room.svelte') then { default: Room }}<Room
        id={route.id}
        roomId={route.room}
        surface={route.surface}
      />{/await}{/key}
{:else if route.name === 'results'}
  {#key route.id + JSON.stringify(route.scope)}{#await import('./screens/Results.svelte') then { default: Results }}<Results
        id={route.id}
        scope={route.scope}
      />{/await}{/key}
{:else if route.name === 'model3d'}
  {#key route.id}{#await import('./screens/Project3D.svelte') then { default: Project3D }}<Project3D
        id={route.id}
      />{/await}{/key}
{:else if route.name === 'project'}
  {#key route.id}{#await import('./screens/Project.svelte') then { default: Project }}<Project
        id={route.id}
      />{/await}{/key}
{:else if route.name === 'shopping'}
  {#key route.id}{#await import('./screens/Shopping.svelte') then { default: Shopping }}<Shopping
        id={route.id}
      />{/await}{/key}
{:else if route.name === 'module' && load}
  {#key route.id}{#await load() then ModuleScreen}<ModuleScreen projectId={route.id} {params} />{/await}{/key}
{:else}
  <Screen title="Page introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Cette page n’existe pas" text="Le lien est peut-être ancien. Revenez à vos projets.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{/if}

<ToastHost />

<style>
  .loading {
    padding: var(--space-6);
    text-align: center;
    color: var(--muted);
  }
</style>
