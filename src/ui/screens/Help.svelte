<script lang="ts">
  /** Comment ça marche (#/aide) : le déroulé en trois étapes et les mots du métier. */
  import Button from '../components/Button.svelte';
  import Screen from '../components/Screen.svelte';
  import { GLOSSARY } from '../lib/glossary';
  import { STEPS } from '../lib/welcome';

  let { onwelcome }: { onwelcome: () => void } = $props();
</script>

<Screen title="Comment ça marche" backHref="#/settings" backLabel="Réglages">
  <div class="help">
    <section aria-labelledby="h-steps">
      <h2 id="h-steps">En trois étapes</h2>
      <ol>
        {#each STEPS as s (s.title)}
          <li>
            <strong>{s.title}</strong>
            <span class="muted">{s.text}</span>
          </li>
        {/each}
      </ol>
      <Button onclick={onwelcome}>Revoir la présentation</Button>
    </section>

    <section aria-labelledby="h-words">
      <h2 id="h-words">Les mots du métier</h2>
      <dl>
        {#each GLOSSARY as t (t.id)}
          <div>
            <dt id="w-{t.id}">{t.word}</dt>
            <dd class="muted">{t.text}</dd>
          </div>
        {/each}
      </dl>
    </section>

    <p class="muted">Les calculs sont indicatifs ; vérifiez toujours les conseils de pose du fabricant.</p>
  </div>
</Screen>

<style>
  .help {
    display: grid;
    gap: var(--space-5);
    max-width: 640px;
  }
  section {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  ol {
    margin: 0;
    padding-left: var(--space-5);
    display: grid;
    gap: var(--space-3);
  }
  li {
    display: grid;
    gap: var(--space-1);
  }
  dl {
    margin: 0;
    display: grid;
    gap: var(--space-3);
  }
  dt {
    font-weight: 600;
  }
  dd {
    margin: 0;
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--muted);
  }
</style>
