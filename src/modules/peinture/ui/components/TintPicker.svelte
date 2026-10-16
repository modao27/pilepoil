<script lang="ts">
  /**
   * Teinte d'une finition, choisie dans la pose (B2) : palette nommée par famille, ou la teinte de la peinture.
   * Les pots s'achètent par teinte.
   */
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import { PAINT_COLORS, shownColor, type ColorFamily } from '../../core/colors';
  import type { PaintColor } from '../../core/types';
  import { FAMILY_LABEL } from '../lib/messages';

  let {
    label,
    value,
    productColor,
    onchange,
  }: {
    /** « Teinte des murs ». */
    label: string;
    value: PaintColor | null;
    /** Teinte de la peinture choisie, proposée en premier. */
    productColor: PaintColor | null;
    onchange: (c: PaintColor | null) => void;
  } = $props();

  let open = $state(false);
  const families = [...new Set(PAINT_COLORS.map((c) => c.family))] as ColorFamily[];
  const current = $derived(
    value?.name ?? (productColor ? `${productColor.name} (teinte de la peinture)` : 'Teinte de la peinture'),
  );
  const same = (c: PaintColor) => value?.hex.toLowerCase() === c.hex.toLowerCase();

  function pick(c: PaintColor | null) {
    onchange(c ? { name: c.name, hex: c.hex } : null);
    open = false;
  }
</script>

<div class="tp">
  <span class="lbl">{label}</span>
  <button type="button" class="current" aria-haspopup="dialog" onclick={() => (open = true)}>
    <span class="dot" style="background: {shownColor(value, productColor)}" aria-hidden="true"></span>
    <span>{current}</span>
    <span class="sr">, changer la teinte</span>
  </button>
</div>

<Dialog bind:open title={label}>
  <div class="body">
    <button type="button" class="swatch product" aria-pressed={value === null} onclick={() => pick(null)}>
      <span class="dot" style="background: {shownColor(null, productColor)}" aria-hidden="true"></span>
      <span>Teinte de la peinture{productColor ? ` : ${productColor.name}` : ''}</span>
    </button>
    {#each families as f (f)}
      <section aria-labelledby="tp-{f}">
        <h3 id="tp-{f}">{FAMILY_LABEL[f]}</h3>
        <div class="grid">
          {#each PAINT_COLORS.filter((c) => c.family === f) as c (c.hex)}
            <button type="button" class="swatch" aria-pressed={same(c)} onclick={() => pick(c)}>
              <span class="dot" style="background: {c.hex}" aria-hidden="true"></span>
              <span>{c.name}</span>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</Dialog>

<style>
  .tp {
    display: grid;
    gap: var(--space-1);
  }
  .lbl {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .current {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .body {
    display: grid;
    gap: var(--space-3);
    max-height: 60dvh;
    overflow-y: auto;
  }
  h3 {
    margin: 0 0 var(--space-1);
    font-size: var(--fs-sm);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: var(--space-1);
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--r-field);
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-sm);
    text-align: left;
    cursor: pointer;
  }
  .swatch:hover {
    background: var(--accent-soft);
  }
  .swatch[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .product {
    border-color: var(--field-border);
  }
  .dot {
    flex: none;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--line);
    border-radius: 50%;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
