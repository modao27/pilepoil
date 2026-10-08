<script lang="ts">
  import { ui } from '../../modules/carrelage';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import IconButton from '../components/IconButton.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
</script>

<Screen title="Mes projets">
  {#snippet actions()}
    <IconButton icon="tiles" label="Bibliothèque de carreaux" href="#/library" />
    <IconButton icon="settings" label="Réglages" href="#/settings" />
  {/snippet}

  {#if app.projects.length === 0}
    <EmptyState
      icon="room"
      title="Aucun projet pour l’instant"
      text="Préparez votre premier calepinage : un mur, un sol ou une pièce entière. Les quantités et les coupes se calculent toutes seules."
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
        <li>{#await ui.ProjectCard() then { default: ProjectCard }}<ProjectCard project={p} />{/await}</li>
      {/each}
    </ul>
  {/if}
</Screen>

<style>
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
