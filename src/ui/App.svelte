<script lang="ts">
  import Button from './components/Button.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Screen from './components/Screen.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import { libraryById, moduleById } from '../modules/registry';
  import LibraryNav from './components/LibraryNav.svelte';
  import { app } from './lib/app.svelte';
  import { matchScreen } from './lib/moduleRoutes';
  import { newProject } from './lib/newProject';
  import { router } from './lib/router.svelte';
  import type { Project as ProjectDoc } from '../state/model';
  import Demo from './screens/Demo.svelte';
  import Home from './screens/Home.svelte';
  import Project from './screens/Project.svelte';
  import Settings from './screens/Settings.svelte';

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
</script>

{#snippet libraryNav()}<LibraryNav current={route.name === 'library' ? route.lib : ''} />{/snippet}

{#if app.fatal}
  <Screen title="Pilepoil">
    <EmptyState icon="warn" title="Impossible d’ouvrir vos données" text={app.fatal} />
  </Screen>
{:else if !app.ready}
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
  <Settings />
{:else if route.name === 'demo'}
  <Demo />
{:else if route.name === 'project'}
  {#key route.id}<Project id={route.id} />{/key}
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
