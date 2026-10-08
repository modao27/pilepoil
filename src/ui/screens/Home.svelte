<script lang="ts">
  import { modules } from '../../modules/registry';
  import type { Project } from '../../state/model';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import IconButton from '../components/IconButton.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
  import { dateShort } from '../lib/format';

  /** Carte du projet : celle du premier outil activé qui en propose une. */
  const cardOf = (p: Project) => modules.find((m) => Object.hasOwn(p.modules, m.id) && m.screens.card);
</script>

<Screen title="Mes projets">
  {#snippet actions()}
    <IconButton icon="tiles" label="Bibliothèques" href="#/library/tiles" />
    <IconButton icon="settings" label="Réglages" href="#/settings" />
  {/snippet}

  {#if app.projects.length === 0}
    <EmptyState
      icon="room"
      title="Aucun projet pour l’instant"
      text="Préparez votre premier chantier : un mur, un sol ou une pièce entière. Les quantités et les coupes se calculent toutes seules."
    >
      {#snippet action()}
        <div class="first">
          <Button variant="primary" icon="plus" href="#/new">Nouveau projet</Button>
          <p class="muted">Vous utilisiez l’ancienne version ? <a href="#/settings">Importez vos données</a>.</p>
        </div>
      {/snippet}
    </EmptyState>
  {:else}
    <div class="top">
      <Button variant="primary" icon="plus" href="#/new">Nouveau projet</Button>
    </div>
    <ul class="list" aria-label="Projets">
      {#each app.projects as p (p.id)}
        {@const withCard = cardOf(p)}
        <li>
          {#if withCard?.screens.card}
            {#await withCard.screens.card() then Card}<Card project={p} />{/await}
          {:else}
            <a class="plain" href="#/p/{p.id}">
              <span class="pname">{p.name}</span>
              <span class="muted"
                >{p.plan.rooms.length} pièce{p.plan.rooms.length > 1 ? 's' : ''} · modifié {dateShort(
                  p.updatedAt,
                )}</span
              >
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</Screen>

<style>
  .plain {
    display: grid;
    gap: var(--space-1);
    min-height: var(--touch);
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: var(--ink);
    text-decoration: none;
  }
  .pname {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
  }
  .first {
    display: grid;
    gap: var(--space-4);
    justify-items: center;
  }
  .first p {
    font-size: var(--fs-sm);
  }
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
    gap: var(--space-3);
  }
</style>
