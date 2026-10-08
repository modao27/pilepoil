<script lang="ts">
  let {
    label,
    checked = $bindable(),
    hint,
    onchange,
  }: { label: string; checked: boolean; hint?: string; onchange?: (v: boolean) => void } = $props();
</script>

<label class="cb">
  <input type="checkbox" bind:checked onchange={() => onchange?.(checked)} />
  <span class="txt">
    <span>{label}</span>
    {#if hint}<small class="muted">{hint}</small>{/if}
  </span>
</label>

<style>
  .cb {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch);
    cursor: pointer;
  }
  input {
    width: 22px;
    height: 22px;
    margin: 0;
    flex: none;
    accent-color: var(--accent);
  }
  .txt {
    display: grid;
  }
  small {
    font-size: var(--fs-xs);
  }
</style>
