<script lang="ts">
  /** Écran éditeur du module : #/p/:id/m/carrelage et #/p/:id/m/carrelage/s/:surfaceId. */
  import type { ModuleScreenProps } from '../../../types';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import Editor from '../editor/Editor.svelte';
  import { reduceProject } from '../../../../state/project';
  import type { Action } from '../../state/actions';
  import { carrelageView } from '../../state/data';
  import { createFloorTiling } from '../../state/factories';
  import { carrelage } from '../state.svelte';

  let { projectId, params }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
  /** Le carrelage n'a encore aucune surface : on propose le sol d'une pièce du plan. */
  const empty = $derived(!!project && !carrelageView(project)?.surfaces.length);

  async function tileFloor(roomId: string) {
    if (!project) return;
    const tiling = createFloorTiling(carrelage.tiles[0]?.id ?? '');
    const action: Action = { type: 'carrelage/floor/enable', roomId, tiling };
    const next = reduceProject(project, action);
    await app.saveProject({ ...next, updatedAt: Date.now() });
  }
</script>

{#if project && empty}
  <Screen title="Carrelage" backHref="#/p/{projectId}" backLabel="Projet">
    {#if project.plan.rooms.length}
      <EmptyState icon="info" title="Rien à carreler pour l’instant" text="Choisissez le sol d’une pièce du plan.">
        {#snippet action()}
          {#each project.plan.rooms as r (r.id)}
            <Button variant="primary" onclick={() => tileFloor(r.id)}>Carreler le sol : {r.name}</Button>
          {/each}
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState icon="info" title="Aucune pièce dans le plan" text="Dessinez la pièce, puis revenez au carrelage.">
        {#snippet action()}<Button variant="primary" href="#/p/{projectId}/plan">Dessiner le plan</Button>{/snippet}
      </EmptyState>
    {/if}
  </Screen>
{:else if project}
  <!-- L'éditeur garde son propre état : recréé seulement quand on change de projet. -->
  {#key projectId}<Editor {project} surfaceId={params.surfaceId ?? null} />{/key}
{:else}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{/if}
