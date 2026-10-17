<script lang="ts">
  /** Suppression refusée d'un produit de bibliothèque utilisé par un projet (lame, carreau, peinture, système). */
  import Button from './Button.svelte';
  import { app } from '../lib/app.svelte';
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

  /** Le projet nommé (le premier de ce nom) : pour aller y changer de produit. */
  const link = $derived(app.projects.find((p) => p.name === project));
</script>

<Dialog open={project != null} {title} onclose={() => (project = null)}>
  <p>{message(project ?? '')}</p>
  {#snippet actions()}
    {#if link}<Button variant="primary" href="#/p/{link.id}">Ouvrir le projet</Button>{/if}
    <Button variant={link ? 'ghost' : 'primary'} onclick={() => (project = null)}>Compris</Button>
  {/snippet}
</Dialog>
