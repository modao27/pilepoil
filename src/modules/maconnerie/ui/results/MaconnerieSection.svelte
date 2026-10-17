<script lang="ts">
  /** Détail des résultats de la maçonnerie : rien avant les murets. */
  import type { ResultSectionProps } from '../../../types';

  let { project }: ResultSectionProps = $props();
</script>

<p data-project={project.id}>Les murets en maçonnerie arrivent dans une prochaine phase.</p>
