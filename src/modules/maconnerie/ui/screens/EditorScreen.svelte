<script lang="ts">
  /** Écran de la maçonnerie (#/p/:id/m/maconnerie) : vérifie le projet, puis affiche l'éditeur des murs. */
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ModuleScreenProps } from '../../../types';
  import MaconnerieEditor from '../components/MaconnerieEditor.svelte';

  let { projectId }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
</script>

{#if project}
  <!-- l'éditeur garde son propre état : recréé seulement quand on change de projet -->
  {#key projectId}<MaconnerieEditor {project} />{/key}
{:else}
  <Screen title="Maçonnerie" backHref="#/" backLabel="Accueil">
    <p>Ce projet n’existe plus.</p>
  </Screen>
{/if}
