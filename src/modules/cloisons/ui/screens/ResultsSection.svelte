<script lang="ts">
  /** Détail des cloisons sur l'écran Résultats (CL3). */
  import type { ResultSectionProps } from '../../../types';

  let props: ResultSectionProps = $props();
</script>

<p class="muted" data-project={props.project.id}>Le détail des cloisons arrive avec leur élévation.</p>
