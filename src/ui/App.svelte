<script lang="ts">
  import Button from './components/Button.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Screen from './components/Screen.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import { app } from './lib/app.svelte';
  import { router } from './lib/router.svelte';
  import Demo from './screens/Demo.svelte';
  import Home from './screens/Home.svelte';
  import Library from './screens/Library.svelte';
  import ProjectView from './screens/ProjectView.svelte';
  import Settings from './screens/Settings.svelte';
  import TileEdit from './screens/TileEdit.svelte';
  import Wizard from './screens/Wizard.svelte';

  const route = $derived(router.route);
</script>

{#if app.fatal}
  <Screen title="Calepinage">
    <EmptyState icon="warn" title="Impossible d’ouvrir vos données" text={app.fatal} />
  </Screen>
{:else if !app.ready}
  <p class="loading" role="status">Chargement…</p>
{:else if route.name === 'home'}
  <Home />
{:else if route.name === 'new'}
  <Wizard />
{:else if route.name === 'library'}
  <Library />
{:else if route.name === 'tile'}
  {#key route.id}<TileEdit id={route.id} />{/key}
{:else if route.name === 'settings'}
  <Settings />
{:else if route.name === 'demo'}
  <Demo />
{:else if route.name === 'project'}
  {#key route.id}<ProjectView id={route.id} surfaceId={route.surfaceId} />{/key}
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
