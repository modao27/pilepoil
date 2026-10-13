<script lang="ts">
  /** Écran des cloisons (#/p/:id/m/cloisons) : vérifie le projet, puis affiche l'éditeur. */
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ModuleScreenProps } from '../../../types';
  import { cloisonsData } from '../../state/spec';
  import CloisonsEditor from '../components/CloisonsEditor.svelte';

  let { projectId }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
</script>

{#if project && cloisonsData(project)}
  <!-- l'éditeur garde son propre état : recréé seulement quand on change de projet -->
  {#key projectId}<CloisonsEditor {project} />{/key}
{:else}
  <Screen title="Cloisons" backHref="#/p/{projectId}" backLabel="Projet">
    <EmptyState
      icon="info"
      title="Pas de cloison dans ce projet"
      text="Dessinez une cloison dans le plan, calque Travaux : ses rails, montants et plaques sont chiffrés ici."
    >
      {#snippet action()}<Button variant="primary" href="#/p/{projectId}/plan">Ouvrir le plan</Button>{/snippet}
    </EmptyState>
  </Screen>
{/if}
