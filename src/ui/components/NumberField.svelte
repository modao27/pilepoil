<script lang="ts">
  import { evaluate, formatNumber } from '../lib/calc';
  import Icon from '../icons/Icon.svelte';

  type Props = {
    label: string;
    /** Valeur interne (mm pour les longueurs). */
    value: number;
    /** Unité affichée. */
    unit?: string;
    /** Valeur interne = valeur affichée × factor (10 pour des cm). */
    factor?: number;
    /** Bornes et pas, en unité affichée. */
    min?: number;
    max?: number;
    step?: number;
    decimals?: number;
    hint?: string;
    id?: string;
    onchange?: (v: number) => void;
  };
  let {
    label,
    value = $bindable(),
    unit = '',
    factor = 1,
    min = -Infinity,
    max = Infinity,
    step = 1,
    decimals = 1,
    hint,
    id = 'nf-' + Math.random().toString(36).slice(2),
    onchange,
  }: Props = $props();

  const shown = (v: number) => formatNumber(v / factor, decimals);
  let text = $state('');
  let error = $state('');
  let editing = $state(false);
  $effect(() => {
    if (!editing) text = shown(value);
  });

  function commit(display: number) {
    const clamped = Math.min(max, Math.max(min, display));
    const next = Math.round(clamped * factor * 1e6) / 1e6;
    error = '';
    text = shown(next);
    if (next !== value) {
      value = next;
      onchange?.(next);
    }
  }

  function apply() {
    editing = false;
    const v = evaluate(text);
    if (v == null) {
      error = 'Saisissez un nombre, par exemple 240 ou 240-12.';
      return;
    }
    if (v < min || v > max) {
      error = `Valeur entre ${formatNumber(min)} et ${formatNumber(max)}${unit ? ' ' + unit : ''}.`;
      commit(v);
      return;
    }
    commit(v);
  }

  const bump = (d: number) => commit(Math.round((value / factor + d * step) * 1e6) / 1e6);
</script>

<div class="nf">
  <label for={id}>{label}</label>
  <div class="row" class:invalid={!!error}>
    <button
      type="button"
      class="pm"
      aria-label="Diminuer {label}"
      onclick={() => bump(-1)}
      disabled={value / factor <= min}
    >
      <Icon name="minus" size={20} />
    </button>
    <div class="box">
      <input
        {id}
        type="text"
        inputmode="decimal"
        autocomplete="off"
        spellcheck="false"
        bind:value={text}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby="{id}-msg"
        onfocus={() => (editing = true)}
        onblur={apply}
        onkeydown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            bump(e.key === 'ArrowUp' ? 1 : -1);
          }
        }}
      />
      {#if unit}<span class="unit" aria-hidden="true">{unit}</span>{/if}
    </div>
    <button
      type="button"
      class="pm"
      aria-label="Augmenter {label}"
      onclick={() => bump(1)}
      disabled={value / factor >= max}
    >
      <Icon name="plus" size={20} />
    </button>
  </div>
  <p id="{id}-msg" class="msg" class:err={!!error} aria-live="polite">{error || hint || ''}</p>
</div>

<style>
  .nf {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }
  label {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .row {
    display: flex;
    align-items: stretch;
    /* bord en ombre intérieure : boutons et champ gardent 44 px pleins */
    box-shadow: inset 0 0 0 1px var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    overflow: hidden;
  }
  .row:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 1px;
  }
  .row.invalid {
    box-shadow: inset 0 0 0 2px var(--thin);
  }
  .box {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
  }
  input {
    flex: 1;
    min-width: 0;
    height: var(--touch);
    padding: 0 var(--space-2);
    border: 0;
    background: transparent;
    font-family: var(--font-num);
    font-size: var(--fs-lg);
    text-align: right;
  }
  input:focus-visible {
    outline: none;
  }
  .unit {
    padding-right: var(--space-2);
    color: var(--muted);
    font-size: var(--fs-sm);
  }
  .pm {
    width: var(--touch);
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }
  .pm:hover {
    background: var(--accent-soft);
  }
  .pm:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .pm:focus-visible {
    outline-offset: -3px;
  }
  .msg {
    min-height: 1.2em;
    font-size: var(--fs-xs);
    color: var(--muted);
  }
  .msg.err {
    color: var(--thin-ink);
  }
</style>
