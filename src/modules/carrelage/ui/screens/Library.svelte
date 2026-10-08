<script lang="ts">
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import TileSwatch from '../components/TileSwatch.svelte';
  import { usedTileIds } from '../../state/selectors';
  import { app } from '../../../../ui/lib/app.svelte';
  import { count, euros, mm, tileSize } from '../../../../ui/lib/format';

  const uses = $derived.by(() => {
    // table locale recalculée à chaque changement (dans $derived), pas d'état mutable partagé
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const n = new Map<string, number>();
    for (const p of app.projects) for (const id of usedTileIds(p)) n.set(id, (n.get(id) ?? 0) + 1);
    return n;
  });
</script>

<Screen title="Bibliothèque de carreaux" backHref="#/" backLabel="Accueil">
  {#if app.tiles.length === 0}
    <EmptyState
      icon="tiles"
      title="Aucun carreau"
      text="Ajoutez vos carreaux une fois : dimensions, couleur ou photo, carton et prix. Vous les choisirez ensuite dans vos projets."
    >
      {#snippet action()}<Button variant="primary" icon="plus" href="#/library/new">Ajouter un carreau</Button
        >{/snippet}
    </EmptyState>
  {:else}
    <div class="top"><Button variant="primary" icon="plus" href="#/library/new">Ajouter un carreau</Button></div>
    <ul class="list" aria-label="Carreaux">
      {#each app.tiles as t (t.id)}
        {@const n = uses.get(t.id) ?? 0}
        <li>
          <a href="#/library/{t.id}">
            <TileSwatch tile={t} size={56} />
            <span class="txt">
              <span class="name">{t.name}</span>
              <span class="muted">
                {tileSize(t.length, t.width, t.shape)} · ép. {mm(t.thickness)}{t.m2PerBox > 0
                  ? ` · ${t.m2PerBox.toLocaleString('fr-FR')} m²/carton`
                  : ' · à la pièce'}
              </span>
              <span class="muted">
                {t.pricePerM2 ? euros(t.pricePerM2) + '/m²' : 'prix non saisi'} · {n
                  ? 'utilisé dans ' + count(n, 'projet', 'projets')
                  : 'inutilisé'}
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
    align-items: center;
    gap: var(--space-3);
    min-height: 72px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: inherit;
    text-decoration: none;
  }
  a:hover {
    border-color: var(--field-border);
  }
  .txt {
    display: grid;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .muted {
    font-size: var(--fs-sm);
  }
</style>
