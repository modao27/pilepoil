<script lang="ts">
  /** Bibliothèque de lames (#/library/boards). */
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { euros, mm } from '../../../../ui/lib/format';
  import type { LibraryScreenProps } from '../../../types';
  import type { Board } from '../../core/board';
  import { KIND_LABEL } from '../lib/labels';

  let { nav }: LibraryScreenProps = $props();

  const boards = $derived((app.libraries.boards ?? []) as readonly Board[]);
  const lengths = (b: Board) =>
    b.lengths.length > 1 ? `${mm(Math.min(...b.lengths))} à ${mm(Math.max(...b.lengths))}` : mm(b.lengths[0] ?? 0);
</script>

<Screen title="Bibliothèques" backHref="#/" backLabel="Accueil">
  {@render nav?.()}
  {#if boards.length === 0}
    <EmptyState
      icon="tiles"
      title="Aucune lame"
      text="Ajoutez vos lames une fois : dimensions, longueurs, paquet et prix. Vous les choisirez ensuite dans vos projets de parquet."
    >
      {#snippet action()}<Button variant="primary" icon="plus" href="#/library/boards/new">Ajouter une lame</Button
        >{/snippet}
    </EmptyState>
  {:else}
    <div class="top"><Button variant="primary" icon="plus" href="#/library/boards/new">Ajouter une lame</Button></div>
    <ul class="list" aria-label="Lames">
      {#each boards as b (b.id)}
        <li>
          <a href="#/library/boards/{b.id}">
            <span class="swatch" style="background: {b.color}" aria-hidden="true"></span>
            <span class="txt">
              <span class="name">{b.name}</span>
              <span class="muted">
                {KIND_LABEL[b.kind]} · {lengths(b)} × {mm(b.width)} · ép. {mm(b.thickness)}{b.handed
                  ? ' · lames A/B'
                  : ''}
              </span>
              <span class="muted">
                {b.boardsPerPack} lames ({b.m2PerPack.toLocaleString('fr-FR')} m²) par paquet · {b.pricePerPack
                  ? euros(b.pricePerPack) + '/paquet'
                  : 'prix non saisi'}
              </span>
            </span>
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
    display: flex;
    gap: var(--space-3);
    align-items: center;
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
  .swatch {
    flex: none;
    width: 56px;
    height: 18px;
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .txt {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
</style>
