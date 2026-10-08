<script lang="ts" generics="T extends string | number">
  /** Liste déroulante native (accessible, clavier et lecteurs d'écran du système). */
  let {
    label,
    value = $bindable(),
    options,
    onchange,
    id = 'sel-' + Math.random().toString(36).slice(2),
  }: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onchange?: (v: T) => void;
    id?: string;
  } = $props();
</script>

<div class="sel">
  <label for={id}>{label}</label>
  <select
    {id}
    value={String(value)}
    onchange={(e) => {
      const o = options.find((x) => String(x.value) === e.currentTarget.value);
      if (!o) return;
      value = o.value;
      onchange?.(o.value);
    }}
  >
    {#each options as o (o.value)}<option value={String(o.value)}>{o.label}</option>{/each}
  </select>
</div>

<style>
  .sel {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }
  label {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  select {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
  }
</style>
