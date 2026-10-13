<script lang="ts">
  /** Élévation d'une cloison (#/p/:id/m/cloisons/c/:partitionId) : charge le projet, puis affiche la vue. */
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ModuleScreenProps } from '../../../types';
  import { cloisonsData } from '../../state/spec';
  import ElevationPage from '../components/ElevationPage.svelte';

  let { projectId, params }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
</script>

{#if project && cloisonsData(project)}
  {#key projectId}<ElevationPage {project} partitionId={params.partitionId ?? ''} />{/key}
{:else}
  <Screen title="Cloison" backHref="#/p/{projectId}" backLabel="Projet">
    <EmptyState icon="info" title="Pas de cloison dans ce projet" text="Dessinez une cloison dans le plan.">
      {#snippet action()}<Button variant="primary" href="#/p/{projectId}/plan">Ouvrir le plan</Button>{/snippet}
    </EmptyState>
  </Screen>
{/if}
