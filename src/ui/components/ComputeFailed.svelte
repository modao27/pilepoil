<script lang="ts">
  /**
   * Le calcul d'un module a échoué (erreur du moteur) : les chiffres affichés sont ceux d'avant la dernière
   * modification. Commun à tous les éditeurs.
   */
  import Button from './Button.svelte';

  let { onretry }: { onretry: () => void } = $props();
</script>

<div class="failed" role="alert">
  <p>
    Le calcul a échoué : les chiffres affichés ne tiennent pas compte de la dernière modification. Réessayez ; si le
    problème revient, annulez la dernière modification.
  </p>
  <Button variant="secondary" onclick={onretry}>Réessayer</Button>
</div>

<style>
  .failed {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-error-bg);
    color: var(--color-error);
  }
  p {
    margin: 0;
  }
</style>
