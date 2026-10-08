<script lang="ts">
  /** Écran éditeur du parquet (#/p/:id/m/parquet) : vérifie le projet, puis affiche l'éditeur. */
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ModuleScreenProps } from '../../../types';
  import { parquetData } from '../../state/module';
  import ParquetEditor from '../components/ParquetEditor.svelte';

  let { projectId }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
</script>

{#if project && parquetData(project)}
  <!-- l'éditeur garde son propre état : recréé seulement quand on change de projet -->
  {#key projectId}<ParquetEditor {project} />{/key}
{:else}
  <Screen title="Parquet" backHref="#/p/{projectId}" backLabel="Projet">
    <EmptyState
      icon="info"
      title="Pas de parquet dans ce projet"
      text="Ajoutez l’outil Parquet depuis l’écran du projet."
    />
  </Screen>
{/if}
