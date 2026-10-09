<script lang="ts">
  /** Vue d'une pièce du plan (#/p/:id/m/carrelage/room/:roomId) : dessus (murs dépliés, liens) et maquette 3D. */
  import type { ModuleScreenProps } from '../../../types';
  import type { ProjectResult } from '../../core';
  import { roomLayout } from '../../render/scene3d/placement';
  import { roomShape } from '../../state/surfaces';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import RoomTopView from '../components/RoomTopView.svelte';
  import Scene3DView from '../components/Scene3DView.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { scenePhoto } from '../lib/photos';

  let { projectId: id, params }: ModuleScreenProps = $props();

  const project = $derived(carrelage.view(id));
  const room = $derived(project?.plan.rooms.find((r) => r.id === params.roomId));
  const spec = $derived(project ? carrelage.spec(project) : null);
  let result = $state.raw<ProjectResult | null>(null);
  let view = $state<'top' | '3d'>('top');

  $effect(() => {
    const p = project;
    if (!p?.surfaces.length) return;
    let live = true;
    void carrelage.result(p).then((r) => live && (result = r));
    return () => (live = false);
  });

  const layout = $derived.by(() => {
    if (!spec || !project || !room) return null;
    const shape = roomShape(project.plan, project.surfaces, room.id);
    return shape && roomLayout(spec, shape);
  });
  const photo = $derived.by(() => {
    void app.photoUrls;
    return project ? scenePhoto(project) : () => null;
  });
</script>

{#if !project || !room}
  <Screen title="Pièce introuvable" backHref={project ? `#/p/${id}/m/carrelage` : '#/'} backLabel="Retour">
    <EmptyState icon="info" title="Cette pièce n’existe plus" text="Elle a peut-être été supprimée du plan.">
      {#snippet action()}<Button variant="primary" href="#/p/{id}/m/carrelage">Voir le carrelage</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title="{room.name} — {project.name}" backHref="#/p/{id}/m/carrelage" backLabel="Carrelage" wide>
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
    <div class="stage">
      {#if !result || !spec || !layout}
        <p class="muted" role="status">Calcul…</p>
      {:else if view === 'top'}
        <RoomTopView {project} {spec} {result} {room} />
      {:else}
        <Scene3DView
          {spec}
          {result}
          {layout}
          shade={project.settings.shadeVariation}
          {photo}
          label="Maquette 3D de {room.name}"
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
