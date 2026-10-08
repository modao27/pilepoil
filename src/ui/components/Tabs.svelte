<script lang="ts" generics="T extends string">
  import type { Snippet } from 'svelte';

  let {
    tabs,
    active = $bindable(),
    label,
    panel,
  }: { tabs: { id: T; label: string }[]; active: T; label: string; panel: Snippet<[T]> } = $props();

  const uid = Math.random().toString(36).slice(2);
  let buttons: HTMLButtonElement[] = $state([]);

  function onkeydown(e: KeyboardEvent, i: number) {
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    active = tabs[n]!.id;
    buttons[n]?.focus();
  }
</script>

<div class="tabs">
  <div class="list" role="tablist" aria-label={label}>
    {#each tabs as t, i (t.id)}
      <button
        bind:this={buttons[i]}
        type="button"
        role="tab"
        id="tab-{uid}-{t.id}"
        aria-selected={t.id === active}
        aria-controls="panel-{uid}-{t.id}"
        tabindex={t.id === active ? 0 : -1}
        onclick={() => (active = t.id)}
        onkeydown={(e) => onkeydown(e, i)}>{t.label}</button
      >
    {/each}
  </div>
  <div class="panel" role="tabpanel" id="panel-{uid}-{active}" aria-labelledby="tab-{uid}-{active}" tabindex="0">
    {@render panel(active)}
  </div>
</div>

<style>
  .list {
    display: flex;
    overflow-x: auto;
    border-bottom: 1px solid var(--line);
    scrollbar-width: none;
  }
  button {
    flex: 1 0 auto;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 0;
    border-bottom: 3px solid transparent;
    background: transparent;
    color: var(--muted);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }
  button[aria-selected='true'] {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
  button:focus-visible {
    outline-offset: -3px;
  }
  .panel {
    padding: var(--space-4) 0;
  }
  .panel:focus-visible {
    outline-offset: 0;
  }
</style>
