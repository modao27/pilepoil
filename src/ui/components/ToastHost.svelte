<script lang="ts">
  import { dismiss, toasts } from '../lib/toasts.svelte';
  import IconButton from './IconButton.svelte';
</script>

<div class="host" role="status" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast" class:error={t.tone === 'error'}>
      <p>{t.message}</p>
      {#if t.action}
        <button
          type="button"
          class="act"
          onclick={() => {
            t.action!.run();
            dismiss(t.id);
          }}>{t.action.label}</button
        >
      {/if}
      <IconButton icon="close" label="Fermer le message" onclick={() => dismiss(t.id)} />
    </div>
  {/each}
</div>

<style>
  .host {
    position: fixed;
    left: var(--gutter);
    right: var(--gutter);
    bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    z-index: 50;
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: min(100%, 480px);
    padding-left: var(--space-4);
    border-radius: var(--r-panel);
    background: var(--ink);
    color: var(--paper);
    box-shadow: var(--shadow);
  }
  .toast :global(.ib) {
    color: var(--paper);
  }
  .toast :global(.ib:hover) {
    background: rgb(255 255 255 / 0.12);
  }
  .error {
    border-left: 6px solid var(--thin);
  }
  p {
    flex: 1;
    padding: var(--space-3) 0;
    font-size: var(--fs-sm);
  }
  .act {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 0;
    background: transparent;
    color: var(--paper);
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
