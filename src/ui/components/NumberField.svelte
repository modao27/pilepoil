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
    /** Plage vraisemblable (unité affichée) : hors de cette plage, la valeur est acceptée mais signalée. */
    soft?: { min?: number; max?: number };
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
    soft,
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
    return clamped;
  }

  const withUnit = (v: number) => formatNumber(v) + (unit ? ' ' + unit : '');
  /** « entre 1 et 250 cm », « au moins 1 cm », « au plus 250 cm ». */
  const range = () =>
    Number.isFinite(min) && Number.isFinite(max)
      ? `entre ${formatNumber(min)} et ${withUnit(max)}`
      : Number.isFinite(min)
        ? `au moins ${withUnit(min)}`
        : `au plus ${withUnit(max)}`;

  function apply() {
    editing = false;
    const v = evaluate(text, unit);
    if (v == null) {
      // refus : la valeur d'avant revient, et le message dit laquelle
      text = shown(value);
      error = `Saisie non comprise, valeur conservée : ${withUnit(value / factor)}. Exemples : 240, 240-12${unit === 'cm' || unit === 'mm' || unit === 'm' ? ', 2,4 m' : ''}.`;
      return;
    }
    const kept = commit(v);
    if (kept !== v) error = `Ramené à ${withUnit(kept)} : la valeur doit être ${range()}.`;
  }

  /** Valeur hors de la plage vraisemblable (acceptée, mais à vérifier). */
  const unusual = $derived.by(() => {
    if (!soft) return '';
    const d = value / factor;
    const low = soft.min != null && d < soft.min,
      high = soft.max != null && d > soft.max;
    return low || high
      ? `${withUnit(d)} est inhabituel${low ? ' (très petit)' : ' (très grand)'} : vérifiez la saisie.`
      : '';
  });

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
        onfocus={() => ((editing = true), (error = ''))}
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
  <p id="{id}-msg" class="msg" class:err={!!error} class:warn={!error && !!unusual} aria-live="polite">
    {error || unusual || hint || ''}
  </p>
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
    outline: 3px solid var(--color-focus);
    outline-offset: 1px;
  }
  .row.invalid {
    box-shadow: inset 0 0 0 2px var(--color-error);
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
    font-variant-numeric: tabular-nums;
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
  .msg.warn {
    color: var(--color-warning, var(--thin-ink));
    font-weight: 500;
  }
</style>
