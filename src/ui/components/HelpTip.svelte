<script lang="ts">
  /** Petit (i) à côté d'un mot du métier : ouvre son explication (glossaire) dans une fenêtre. */
  import { term } from '../lib/glossary';
  import Dialog from './Dialog.svelte';
  import IconButton from './IconButton.svelte';

  let { id }: { id: string } = $props();
  const t = $derived(term(id));
  let open = $state(false);
</script>

{#if t}
  <IconButton icon="info" label="Que veut dire « {t.word.toLowerCase()} » ?" onclick={() => (open = true)} />
  <Dialog bind:open title={t.word}>
    <p>{t.text}</p>
    <p><a href="#/aide">Tous les mots expliqués</a></p>
  </Dialog>
{/if}

<style>
  p {
    margin: 0 0 var(--space-3);
  }
</style>
