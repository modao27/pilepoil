<script lang="ts">
  /** Présentation en trois écrans, au premier lancement puis à la demande (page « Comment ça marche »). */
  import { app } from '../lib/app.svelte';
  import { go, router } from '../lib/router.svelte';
  import { STEPS } from '../lib/welcome';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import Icon, { type IconName } from '../icons/Icon.svelte';

  const ICONS: IconName[] = ['room', 'tiles', 'shopping'];
  let page = $state(0);
  const step = $derived(STEPS[page]!);
  const last = $derived(page === STEPS.length - 1);
  /** Seulement sur l'accueil et l'aide : un lien direct vers un projet ou un plan n'est pas interrompu. */
  const shown = $derived(
    app.welcomeOpen && (router.route.name === 'help' || (router.route.name === 'home' && app.projects.length === 0)),
  );

  $effect(() => {
    if (app.welcomeOpen) page = 0;
  });

  function finish(start: boolean) {
    app.closeWelcome();
    if (start && app.projects.length === 0) go({ name: 'new' });
  }
</script>

<Dialog open={shown} title={step.title} onclose={() => app.closeWelcome()}>
  <div class="step">
    <span class="ic" aria-hidden="true"><Icon name={ICONS[page] ?? 'info'} size={48} /></span>
    <p>{step.text}</p>
    <p class="count muted" role="status">Écran {page + 1} sur {STEPS.length}</p>
  </div>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => finish(false)}>Passer</Button>
    {#if last}
      <Button variant="primary" icon="plus" onclick={() => finish(true)}>Commencer</Button>
    {:else}
      <Button variant="primary" onclick={() => (page += 1)}>Suivant</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .step {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    text-align: center;
  }
  .ic {
    color: var(--accent);
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--muted);
  }
</style>
