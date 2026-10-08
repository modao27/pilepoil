<script lang="ts">
  /** Écran éditeur du module : #/p/:id/m/carrelage et #/p/:id/m/carrelage/s/:surfaceId. */
  import type { ModuleScreenProps } from '../../../types';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import Editor from '../editor/Editor.svelte';

  let { projectId, params }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
</script>

{#if project}
  <!-- L'éditeur garde son propre état : recréé seulement quand on change de projet. -->
  {#key projectId}<Editor {project} surfaceId={params.surfaceId ?? null} />{/key}
{:else}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{/if}
