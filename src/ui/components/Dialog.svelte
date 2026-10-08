<script lang="ts">
  /** Boîte de dialogue modale native (<dialog>) : focus piégé et Échap gérés par le navigateur. */
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  let {
    open = $bindable(false),
    title,
    children,
    actions,
    onclose,
  }: { open: boolean; title: string; children: Snippet; actions?: Snippet; onclose?: () => void } = $props();

  let dlg: HTMLDialogElement;
  const uid = Math.random().toString(36).slice(2);

  $effect(() => {
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  });
</script>

<dialog
  bind:this={dlg}
  aria-labelledby="dlg-{uid}"
  onclose={() => {
    open = false;
    onclose?.();
  }}
  onclick={(e) => {
    if (e.target === dlg) dlg.close();
  }}
>
  <div class="inner">
    <header>
      <h2 id="dlg-{uid}">{title}</h2>
      <IconButton icon="close" label="Fermer" onclick={() => dlg.close()} />
    </header>
    <div class="body">{@render children()}</div>
    {#if actions}<footer>{@render actions()}</footer>{/if}
  </div>
</dialog>

<style>
  dialog {
    width: min(100% - 2 * var(--gutter), 480px);
    max-height: min(90dvh, 720px);
    padding: 0;
    border: 0;
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  dialog::backdrop {
    background: var(--scrim);
  }
  .inner {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
