<script lang="ts">
  /**
   * Vue 3D du projet (#/p/:id/3d, docs/NAVIGATION.md §3) : maquette de toutes les pièces avec leurs revêtements,
   * murs pleins, bas ou coupés côté caméra. Toucher une pièce la met en évidence ; la toucher encore, ou
   * « Ouvrir », ouvre son écran. Les pièces se choisissent aussi dans la liste (clavier, lecteur d'écran).
   */
  import type { Id } from '../../core/plan/types';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ProjectModel from '../components/ProjectModel.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
  import { loadModel3D, type Model3DLibs } from '../lib/model3d';
  import { go } from '../lib/router.svelte';

  let { id }: { id: string } = $props();

  const project = $derived(app.project(id));
  const rooms = $derived(project?.plan.rooms ?? []);
  let selected = $state<Id | null>(null);
  const room = $derived(rooms.find((r) => r.id === selected));

  let libs = $state.raw<Model3DLibs | null>(null);
  $effect(() => void loadModel3D().then((l) => (libs = l)));
  const ring = $derived(libs && project && selected ? libs.cutaway.roomRing(project.plan, selected) : null);

  function pick([x, z]: [number, number]) {
    if (!libs || !project) return;
    const hit = libs.cutaway.pickRoom(
      project.plan,
      rooms.map((r) => r.id),
      [x * 1000, z * 1000],
    );
    if (hit && hit === selected) go({ name: 'room', id, room: hit });
    else selected = hit;
  }
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title="Vue 3D — {project.name}" backHref="#/p/{id}" backLabel="Projet" wide>
    {#snippet actions()}{#if project.poses.length}<Button variant="ghost" href="#/p/{id}/resultats">Résultats</Button
        >{/if}{/snippet}
    {#if rooms.length}
      <div class="model">
        <ProjectModel {project} label="Maquette 3D de {project.name}" highlight={ring} onpick={pick} />
      </div>
      <div class="panel" aria-live="polite">
        {#if room}
          <p><strong>{room.name}</strong> <span class="muted">Touchez-la encore pour l’ouvrir.</span></p>
          <Button variant="primary" icon="forward" href="#/p/{id}/r/{room.id}">Ouvrir {room.name}</Button>
        {:else}
          <p class="muted">Touchez une pièce pour la choisir.</p>
        {/if}
      </div>
      <nav aria-label="Pièces">
        <ul class="rooms">
          {#each rooms as r (r.id)}
            <li>
              <button
                type="button"
                class="chip"
                aria-pressed={selected === r.id}
                onclick={() => (selected = selected === r.id ? null : r.id)}>{r.name}</button
              >
            </li>
          {/each}
        </ul>
      </nav>
    {:else}
      <EmptyState icon="room" title="Aucune pièce dessinée" text="Dessinez une pièce sur le plan pour la voir en 3D.">
        {#snippet action()}<Button variant="primary" href="#/p/{id}/plan">Dessiner le plan</Button>{/snippet}
      </EmptyState>
    {/if}
  </Screen>
{/if}

<style>
  .model {
    position: relative;
    height: min(68dvh, 720px);
    min-height: 320px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
    min-height: calc(var(--target-min) + var(--space-2));
    margin-top: var(--space-3);
  }
  .panel p {
    margin: 0;
  }
  .rooms {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    padding: 0;
    list-style: none;
  }
  .chip {
    min-height: var(--target-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-field-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-on-primary);
  }
</style>
