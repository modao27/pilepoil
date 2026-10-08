<script lang="ts">
  /** Onglets des bibliothèques de produits (une par module qui en déclare une). */
  import { libraries } from '../../modules/registry';

  let { current }: { current: string } = $props();
</script>

<nav class="libs" aria-label="Bibliothèques">
  {#each libraries as l (l.id)}
    <a href="#/library/{l.id}" aria-current={l.id === current ? 'page' : undefined}>{l.label}</a>
  {/each}
</nav>

<style>
  .libs {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--line);
  }
  a {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 var(--space-4);
    border-bottom: 3px solid transparent;
    color: var(--muted);
    font-weight: 600;
    text-decoration: none;
  }
  a:hover {
    color: var(--ink);
  }
  a[aria-current='page'] {
    border-bottom-color: var(--accent);
    color: var(--ink);
  }
</style>
