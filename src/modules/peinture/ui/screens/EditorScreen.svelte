<script lang="ts">
  /** Écran de pose de peinture (module encore caché : l'écran complet arrive en PE3). */
  import Screen from '../../../../ui/components/Screen.svelte';
  import type { ModuleScreenProps } from '../../../types';

  let { projectId }: ModuleScreenProps = $props();
</script>

<Screen title="Peinture" backHref="#/p/{projectId}" backLabel="Projet">
  <p>Cet outil arrive bientôt.</p>
</Screen>
