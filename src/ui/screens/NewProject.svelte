<script lang="ts">
  /**
   * Nouveau projet (#/new) : choix de l'outil. Un outil qui a son assistant (carrelage) l'ouvre ; les autres
   * (parquet) créent un projet vide avec l'outil activé, puis ouvrent le plan pour dessiner les pièces.
   */
  import { emptyPlan } from '../../core/plan/factories';
  import { modules } from '../../modules/registry';
  import type { ToolModule } from '../../modules/types';
  import { PROJECT_SCHEMA, type Project } from '../../state/model';
  import Button from '../components/Button.svelte';
  import Screen from '../components/Screen.svelte';
  import TextField from '../components/TextField.svelte';
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';

  let name = $state('Mon projet');
  let busy = $state(false);

  async function start(m: ToolModule) {
    if (busy) return;
    busy = true;
    try {
      const now = Date.now();
      const plan = emptyPlan();
      const p: Project = {
        schemaVersion: PROJECT_SCHEMA,
        id: crypto.randomUUID(),
        name: name.trim() || 'Mon projet',
        createdAt: now,
        updatedAt: now,
        plan,
        modules: { [m.id]: { schemaVersion: m.schemaVersion, data: m.create(plan) } },
      };
      if (await app.trySaveProject(p)) go({ name: 'plan', id: p.id });
    } finally {
      busy = false;
    }
  }
</script>

<Screen title="Nouveau projet" backHref="#/" backLabel="Mes projets">
  <div class="new">
    <TextField label="Nom du projet" bind:value={name} />
    <h2>Que voulez-vous poser ?</h2>
    <ul class="tools">
      {#each modules as m (m.id)}
        <li class="card">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- tracé de l'icône du module, fourni par le code -->
          <svg class="icon" viewBox="0 0 34 24" aria-hidden="true">{@html m.icon}</svg>
          <span class="text">
            <span class="title">{m.label}</span>
            <span class="muted">{m.description}</span>
          </span>
          {#if m.screens.create}
            <Button variant="primary" href="#/new/{m.id}">Commencer : {m.label.toLowerCase()}</Button>
          {:else}
            <Button variant="primary" disabled={busy} onclick={() => void start(m)}
              >Commencer : {m.label.toLowerCase()}</Button
            >
          {/if}
        </li>
      {/each}
    </ul>
    <p class="muted">Le parquet commence par le plan : dessinez les pièces, puis choisissez la lame et la pose.</p>
  </div>
</Screen>

<style>
  .new {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-md);
  }
  .tools {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .icon {
    flex: none;
    width: 51px;
    height: 36px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .text {
    flex: 1;
    min-width: 180px;
    display: grid;
  }
  .title {
    font-weight: 600;
  }
  .muted {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }
</style>
