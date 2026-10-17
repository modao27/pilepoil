<script lang="ts">
  import ProjectCard from '../components/ProjectCard.svelte';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import IconButton from '../components/IconButton.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
</script>

<Screen title="Mes projets" brand>
  {#snippet actions()}
    <IconButton icon="library" label="Bibliothèques" href="#/library/tiles" />
    <IconButton icon="settings" label="Réglages" href="#/settings" />
  {/snippet}

  {#if app.projects.length === 0}
    <EmptyState
      icon="room"
      title="Aucun projet pour l’instant"
      text="Préparez votre premier chantier : un mur, un sol ou une pièce entière. Les quantités et les coupes se calculent toutes seules."
    >
      {#snippet action()}
        <Button variant="primary" icon="plus" href="#/new">Nouveau projet</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <div class="top">
      <Button variant="primary" icon="plus" href="#/new">Nouveau projet</Button>
    </div>
    <ul class="list" aria-label="Projets">
      {#each app.projects as p (p.id)}
        <li><ProjectCard project={p} /></li>
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
    gap: var(--space-3);
  }
</style>
