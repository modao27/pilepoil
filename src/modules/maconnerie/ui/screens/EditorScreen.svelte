<script lang="ts">
  /** Écran de la maçonnerie (#/p/:id/m/maconnerie) : en attendant les murets, renvoie vers la bibliothèque. */
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import type { ModuleScreenProps } from '../../../types';

  let { projectId }: ModuleScreenProps = $props();
</script>

<Screen title="Maçonnerie" backHref="#/p/{projectId}" backLabel="Projet">
  <EmptyState
    icon="info"
    title="Pas encore de mur en maçonnerie"
    text="Les murets arrivent bientôt. La bibliothèque de matériaux est déjà disponible."
  >
    {#snippet action()}<Button variant="primary" href="#/library/materials">Ouvrir la bibliothèque</Button>{/snippet}
  </EmptyState>
</Screen>
