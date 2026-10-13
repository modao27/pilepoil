<script lang="ts">
  /** Écran de pose de peinture (#/p/:id/m/peinture[/pose/:poseId]) : vérifie le projet, puis affiche l'éditeur. */
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ModuleScreenProps } from '../../../types';
  import { peintureData } from '../../state/poses';
  import PeintureEditor from '../components/PeintureEditor.svelte';

  let { projectId, params }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
</script>

{#if project && peintureData(project)}
  <!-- l'éditeur garde son propre état : recréé seulement quand on change de projet -->
  {#key projectId}<PeintureEditor {project} poseId={params.poseId} />{/key}
{:else}
  <Screen title="Peinture" backHref="#/p/{projectId}" backLabel="Projet">
    <EmptyState icon="info" title="Pas de peinture dans ce projet" text="Peignez un mur depuis l’écran de la pièce." />
  </Screen>
{/if}
