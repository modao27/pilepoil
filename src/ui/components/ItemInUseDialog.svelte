<script lang="ts">
  /** Suppression refusée d'un produit de bibliothèque utilisé par un projet (lame, carreau, peinture, système). */
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  let {
    project = $bindable(),
    title,
    message,
  }: {
    /** Nom du projet qui utilise le produit ; null : dialogue fermé. */
    project: string | null;
    /** « Lame utilisée ». */
    title: string;
    /** Phrase à partir du nom du projet. */
    message: (project: string) => string;
  } = $props();
</script>

<Dialog open={project != null} {title} onclose={() => (project = null)}>
  <p>{message(project ?? '')}</p>
  {#snippet actions()}<Button variant="primary" onclick={() => (project = null)}>Compris</Button>{/snippet}
</Dialog>
