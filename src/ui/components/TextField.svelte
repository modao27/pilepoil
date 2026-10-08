<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'value'> & { label: string; value: string; hint?: string; error?: string };
  let {
    label,
    value = $bindable(),
    hint,
    error,
    id = 'tf-' + Math.random().toString(36).slice(2),
    ...rest
  }: Props = $props();
</script>

<div class="tf">
  <label for={id}>{label}</label>
  <input
    {id}
    type="text"
    bind:value
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={hint || error ? `${id}-msg` : undefined}
    {...rest}
  />
  {#if hint || error}<p id="{id}-msg" class="msg" class:err={!!error}>{error || hint}</p>{/if}
</div>

<style>
  .tf {
    display: grid;
    gap: var(--space-1);
  }
  label {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  input {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
  }
  input[aria-invalid='true'] {
    border-color: var(--thin);
  }
  .msg {
    font-size: var(--fs-xs);
    color: var(--muted);
  }
  .msg.err {
    color: var(--thin-ink);
  }
</style>
