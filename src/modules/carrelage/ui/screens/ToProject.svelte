<script lang="ts">
  /**
   * #/p/:id/m/carrelage : le choix du sol et des murs à carreler se fait sur l'écran Pièce, depuis la vue globale.
   * Cette adresse y mène (sans nouvelle entrée d'historique).
   */
  import { go } from '../../../../ui/lib/router.svelte';
  import type { ModuleScreenProps } from '../../../types';

  let { projectId }: ModuleScreenProps = $props();
  $effect(() => go({ name: 'project', id: projectId }, true));
</script>
