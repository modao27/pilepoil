<script lang="ts" generics="T extends string | number">
  import Icon, { type IconName } from '../icons/Icon.svelte';

  type Option = { value: T; label: string; icon?: IconName };
  let {
    options,
    value = $bindable(),
    label,
    onchange,
  }: { options: Option[]; value: T; label: string; onchange?: (v: T) => void } = $props();

  let buttons: HTMLButtonElement[] = $state([]);

  function select(v: T) {
    value = v;
    onchange?.(v);
  }

  /** Radiogroup : flèches pour changer de choix, une seule tabulation pour tout le groupe. */
  function onkeydown(e: KeyboardEvent, i: number) {
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    select(options[n]!.value);
    buttons[n]?.focus();
  }
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o, i (o.value)}
    <button
      bind:this={buttons[i]}
      type="button"
      role="radio"
      aria-checked={o.value === value}
      tabindex={o.value === value ? 0 : -1}
      onclick={() => select(o.value)}
      onkeydown={(e) => onkeydown(e, i)}
    >
      {#if o.icon}<Icon name={o.icon} size={20} />{/if}
      <span>{o.label}</span>
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    padding: 0;
    gap: 0;
    /* bord en ombre intérieure : les boutons gardent 44 px pleins */
    box-shadow: inset 0 0 0 1px var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    width: fit-content;
    max-width: 100%;
    overflow-x: auto;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-height: var(--touch);
    min-width: var(--touch);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex: 1 0 auto;
  }
  button[aria-checked='true'] {
    background: var(--accent);
    color: var(--on-accent);
  }
  button:not([aria-checked='true']):hover {
    background: var(--accent-soft);
  }
</style>
