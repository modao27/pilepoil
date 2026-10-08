<script lang="ts">
  /** Chiffre clé (Barlow Condensed) avec libellé ; `status` colore le liseré (coupe, réemploi, alerte). */
  let {
    label,
    value,
    unit = '',
    status,
  }: { label: string; value: string; unit?: string; status?: 'cut' | 'reuse' | 'thin' } = $props();
</script>

<div class="stat {status ?? ''}">
  <span class="lbl">{label}</span>
  <span class="val num"
    >{value}{#if unit}<small> {unit}</small>{/if}</span
  >
</div>

<style>
  .stat {
    display: grid;
    gap: 2px;
    padding: var(--space-3);
    border-radius: var(--r-field);
    background: var(--sheet);
    border: 1px solid var(--line);
    border-left: 4px solid var(--line);
    min-width: 0;
  }
  .cut {
    border-left-color: var(--cut);
  }
  .reuse {
    border-left-color: var(--reuse);
  }
  .thin {
    border-left-color: var(--thin);
  }
  .lbl {
    font-size: var(--fs-xs);
    color: var(--muted);
  }
  .val {
    font-size: var(--fs-xl);
    font-weight: 600;
    line-height: 1.1;
  }
  small {
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--muted);
  }
</style>
