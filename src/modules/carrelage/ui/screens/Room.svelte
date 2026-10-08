<script lang="ts">
  import type { ModuleScreenProps } from '../../../types';
  /** Pièce : vue de dessus (murs dépliés, surfaces cliquables) et maquette 3D. */
  import type { ProjectResult } from '../../core';
  import { roomLayout, surfaceLayout } from '../../render/scene3d/placement';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import RoomTopView from '../components/RoomTopView.svelte';
  import Scene3DView from '../components/Scene3DView.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { scenePhoto } from '../lib/photos';

  let { projectId: id }: ModuleScreenProps = $props();

  const project = $derived(carrelage.view(id));
  const spec = $derived(project ? carrelage.spec(project) : null);
  let result = $state.raw<ProjectResult | null>(null);
  let view = $state<'top' | '3d'>('top');

  $effect(() => {
    const p = project;
    if (!p) return;
    let live = true;
    void carrelage.result(p).then((r) => live && (result = r));
    return () => (live = false);
  });

  const layout = $derived(
    spec && project ? (project.room ? roomLayout(spec, project.room.height) : surfaceLayout(spec, 0)) : null,
  );
  const photo = $derived.by(() => {
    void app.photoUrls;
    return project ? scenePhoto(project) : () => null;
  });
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen
    title={project.room ? `Pièce — ${project.name}` : project.name}
    backHref="#/p/{project.id}/m/carrelage"
    backLabel="Retour au plan"
    wide
  >
    {#snippet actions()}
      <Segmented
        label="Vue de la pièce"
        bind:value={view}
        options={[
          { value: 'top', label: 'Dessus' },
          { value: '3d', label: '3D' },
        ]}
      />
    {/snippet}
    <div class="stage" class:three={view === '3d'}>
      {#if !result || !spec || !layout}
        <p class="muted" role="status">Calcul…</p>
      {:else if view === 'top'}
        <RoomTopView {project} {spec} {result} />
      {:else}
        <Scene3DView
          {spec}
          {result}
          {layout}
          shade={project.settings.shadeVariation}
          {photo}
          label="Maquette 3D de {project.name}"
        />
      {/if}
    </div>
    {#if view === 'top'}<p class="muted">Touchez une surface pour la régler.</p>{/if}
  </Screen>
{/if}

<style>
  .stage {
    position: relative;
    min-height: 320px;
    height: calc(100dvh - 160px);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    overflow: hidden;
  }
  .muted {
    padding: var(--space-2) 0;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
</style>
