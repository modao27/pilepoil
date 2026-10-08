<script lang="ts">
  import { PATTERNS, type PatternId, type PatternModule } from '../../modules/carrelage';

  let {
    value = $bindable(),
    shape,
    onchange,
  }: {
    value: PatternId;
    /** Limite aux motifs d'une forme de carreau (rect : motifs droits, sinon le motif de la forme). */
    shape?: PatternModule['shape'];
    onchange?: (p: PatternId) => void;
  } = $props();

  const list = $derived(shape ? PATTERNS.filter((p) => p.shape === shape) : PATTERNS);
  let buttons: HTMLButtonElement[] = $state([]);

  function select(id: PatternId) {
    value = id;
    onchange?.(id);
  }
  function onkeydown(e: KeyboardEvent, i: number) {
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + list.length) % list.length;
    select(list[n]!.id);
    buttons[n]?.focus();
  }
</script>

<div class="pp" role="radiogroup" aria-label="Motif de pose">
  {#each list as p, i (p.id)}
    <button
      bind:this={buttons[i]}
      type="button"
      role="radio"
      aria-checked={value === p.id}
      tabindex={value === p.id || (i === 0 && !list.some((x) => x.id === value)) ? 0 : -1}
      onclick={() => select(p.id)}
      onkeydown={(e) => onkeydown(e, i)}
    >
      <!-- Icônes : chaînes SVG constantes du registre des motifs (src/core/patterns), jamais de saisie utilisateur. -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <svg viewBox="0 0 34 24" aria-hidden="true">{@html p.icon}</svg>
      <span>{p.label}</span>
    </button>
  {/each}
</div>

<style>
  .pp {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--space-2);
  }
  button {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: var(--space-1);
    min-height: 80px;
    padding: var(--space-2);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    cursor: pointer;
    font-size: var(--fs-sm);
  }
  button:hover {
    border-color: var(--ink);
  }
  button[aria-checked='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    background: var(--accent-soft);
  }
  svg {
    width: 48px;
    height: 34px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.2;
  }
</style>
