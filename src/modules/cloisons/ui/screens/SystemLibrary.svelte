<script lang="ts">
  /** Bibliothèque des systèmes de cloison (#/library/systems). */
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { LibraryScreenProps } from '../../../types';
  import type { PartitionSystem } from '../../core/types';

  let { nav }: LibraryScreenProps = $props();

  const systems = $derived((app.libraries.systems ?? []) as readonly PartitionSystem[]);
  const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
</script>

<Screen title="Bibliothèques" backHref="#/" backLabel="Accueil">
  {@render nav?.()}
  {#if systems.length === 0}
    <EmptyState
      icon="tiles"
      title="Aucun système de cloison"
      text="Un système donne l’épaisseur finie, l’ossature et les plaques d’une cloison : 72/48, 98/48, 100/70…"
    >
      {#snippet action()}<Button variant="primary" icon="plus" href="#/library/systems/new">Ajouter un système</Button
        >{/snippet}
    </EmptyState>
  {:else}
    <div class="top">
      <Button variant="primary" icon="plus" href="#/library/systems/new">Ajouter un système</Button>
    </div>
    <ul class="list" aria-label="Systèmes de cloison">
      {#each systems as s (s.id)}
        <li>
          <a href="#/library/systems/{s.id}">
            <span class="name">{s.name}</span>
            <span class="muted"
              >{fr(s.thickness)} mm finis · ossature {fr(s.studWidth)} mm · {s.layers} plaque{s.layers > 1 ? 's' : ''} de
              {fr(s.plateThickness)} mm par face</span
            >
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Screen>

<style>
  .top {
    display: flex;
    margin-bottom: var(--space-4);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
    gap: var(--space-2);
  }
  a {
    display: grid;
    gap: 2px;
    min-height: var(--touch);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: var(--ink);
    text-decoration: none;
  }
  a:hover {
    border-color: var(--accent);
  }
  .name {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
</style>
