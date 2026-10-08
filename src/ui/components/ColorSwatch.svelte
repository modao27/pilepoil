<script lang="ts">
  /** Choix d'une couleur : nuancier rapide + sélecteur libre. */
  let {
    label,
    value = $bindable(),
    palette = [],
    onchange,
  }: { label: string; value: string; palette?: string[]; onchange?: (v: string) => void } = $props();

  const id = 'cs-' + Math.random().toString(36).slice(2);
  function set(v: string) {
    value = v;
    onchange?.(v);
  }
</script>

<fieldset class="cs">
  <legend>{label}</legend>
  <div class="row">
    <label class="custom" for={id} style="--c: {value}">
      <input {id} type="color" {value} oninput={(e) => set(e.currentTarget.value)} />
      <span class="visually-hidden">Autre couleur, actuelle {value}</span>
    </label>
    {#each palette as c (c)}
      <button
        type="button"
        class="sw"
        style="--c: {c}"
        aria-label="Couleur {c}"
        aria-pressed={c.toLowerCase() === value.toLowerCase()}
        onclick={() => set(c)}
      ></button>
    {/each}
  </div>
</fieldset>

<style>
  .cs {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: var(--space-1);
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .custom,
  .sw {
    position: relative;
    width: var(--touch);
    height: var(--touch);
    border-radius: var(--r-field);
    border: 1px solid var(--field-border);
    background: var(--c);
    cursor: pointer;
    padding: 0;
  }
  .custom::after {
    content: '';
    position: absolute;
    right: -4px;
    bottom: -4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
    border: 2px solid var(--sheet);
  }
  .custom:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .custom input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  .sw[aria-pressed='true'] {
    box-shadow:
      0 0 0 2px var(--sheet),
      0 0 0 4px var(--ink);
  }
</style>
