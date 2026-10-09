<script lang="ts">
  /** Éditeur d'une surface : #/p/:id/m/carrelage/s/:surfaceId. Rien à carreler : retour à l'écran Carrelage. */
  import type { ModuleScreenProps } from '../../../types';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { go } from '../../../../ui/lib/router.svelte';
  import Editor from '../editor/Editor.svelte';
  import { carrelageView } from '../../state/data';

  let { projectId, params }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
  const empty = $derived(!!project && !carrelageView(project)?.surfaces.length);

  $effect(() => {
    if (empty) go({ name: 'module', id: projectId, module: 'carrelage', path: '' }, true);
  });
</script>

{#if project && !empty}
  <!-- L'éditeur garde son propre état : recréé seulement quand on change de projet. -->
  {#key projectId}<Editor {project} surfaceId={params.surfaceId ?? null} />{/key}
{:else if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{/if}
