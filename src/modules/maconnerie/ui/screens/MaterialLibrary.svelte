<script lang="ts">
  /** Bibliothèque des matériaux de maçonnerie (#/library/materials). */
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { LibraryScreenProps } from '../../../types';
  import { FAMILY_LABEL } from '../../core/defaults';
  import type { Material } from '../../core/types';

  let { nav }: LibraryScreenProps = $props();

  const materials = $derived((app.libraries.materials ?? []) as readonly Material[]);
  const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
</script>

<Screen title="Bibliothèques" backHref="#/" backLabel="Accueil">
  {@render nav?.()}
  {#if materials.length === 0}
    <EmptyState
      icon="tiles"
      title="Aucun matériau"
      text="Un matériau donne ses dimensions, son poids et sa technique de pose : joints, appareillage, liant."
    >
      {#snippet action()}<Button variant="primary" icon="plus" href="#/library/materials/new"
          >Ajouter un matériau</Button
        >{/snippet}
    </EmptyState>
  {:else}
    <div class="top">
      <Button variant="primary" icon="plus" href="#/library/materials/new">Ajouter un matériau</Button>
    </div>
    <p class="muted">Valeurs données à titre indicatif (estimation) : vérifiez la fiche du fabricant.</p>
    <ul class="list" aria-label="Matériaux de maçonnerie">
      {#each materials as m (m.id)}
        <li>
          <a href="#/library/materials/{m.id}">
            <span class="name">{m.name}</span>
            <span class="muted"
              >{FAMILY_LABEL[m.family]} · {fr(m.length)} × {fr(m.height)} × {fr(m.thickness)} mm{m.weight == null
                ? ' · poids à compléter'
                : ` · ${fr(m.weight)} kg`}</span
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
