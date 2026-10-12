<script lang="ts">
  /** Écran : barre haute (retour ou logo, titre, actions) et contenu centré. */
  import type { Snippet } from 'svelte';
  import logoDark from '../design/identite/logo/horizontal/pilepoil-horizontal-mono-blanc.svg';
  import logo from '../design/identite/logo/horizontal/pilepoil-horizontal-couleur.svg';
  import { appName } from '../brand';
  import IconButton from './IconButton.svelte';

  let {
    title,
    backHref,
    backLabel = 'Retour',
    actions,
    children,
    wide = false,
    brand = false,
  }: {
    title: string;
    backHref?: string;
    backLabel?: string;
    actions?: Snippet;
    children: Snippet;
    wide?: boolean;
    /** Logo horizontal en tête de barre (accueil). */
    brand?: boolean;
  } = $props();
</script>

<header class="bar">
  <div class="inner" class:wide>
    {#if backHref}<IconButton icon="back" label={backLabel} href={backHref} />{/if}
    {#if brand}
      <!-- couleur en clair, mono blanc en sombre : le pétrole du mot ne se lit pas sur fond sombre -->
      <span class="brand" role="img" aria-label={appName}>
        <img class="light" src={logo} alt="" width="113" height="28" />
        <img class="dark" src={logoDark} alt="" width="113" height="28" />
      </span>
    {/if}
    <h1>{title}</h1>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </div>
</header>
<main class="content" class:wide>
  {@render children()}
</main>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
    padding-top: env(safe-area-inset-top);
  }
  .inner {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 960px;
    min-height: 56px;
    margin: 0 auto;
    padding: 0 calc(var(--gutter) - 6px);
  }
  .inner:not(:has(> :global(.ib:first-child))) {
    padding-left: var(--gutter);
  }
  .brand {
    flex: none;
    display: flex;
    margin-right: var(--space-3);
  }
  .brand img {
    display: block;
    height: 28px;
    width: auto;
  }
  .dark {
    display: none !important;
  }
  :global(:root[data-theme='dark']) .light {
    display: none !important;
  }
  :global(:root[data-theme='dark']) .dark {
    display: block !important;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .light {
      display: none !important;
    }
    :global(:root:not([data-theme='light'])) .dark {
      display: block !important;
    }
  }
  h1 {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-lg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .content {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--space-4) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom));
  }
  .wide {
    max-width: 1280px;
  }
</style>
