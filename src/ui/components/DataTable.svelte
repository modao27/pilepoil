<script lang="ts" generics="R">
  /** Tableau avec défilement horizontal sur mobile ; colonnes numériques alignées à droite. */
  type Column = { key: string; label: string; numeric?: boolean; cell: (row: R) => string };
  let { caption, columns, rows }: { caption: string; columns: Column[]; rows: R[] } = $props();
</script>

<!-- Zone défilante focalisable : défilement horizontal au clavier sur mobile (règle axe scrollable-region-focusable). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="wrap" role="region" aria-label={caption} tabindex="0">
  <table>
    <caption class="visually-hidden">{caption}</caption>
    <thead>
      <tr>
        {#each columns as c (c.key)}<th scope="col" class:n={c.numeric}>{c.label}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as r, i (i)}
        <tr>
          {#each columns as c (c.key)}<td class:n={c.numeric} class:num={c.numeric}>{c.cell(r)}</td>{/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--sheet);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  th,
  td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--line);
  }
  th {
    font-weight: 600;
    color: var(--muted);
    font-size: var(--fs-xs);
    background: var(--paper);
  }
  tr:last-child td {
    border-bottom: 0;
  }
  .n {
    text-align: right;
  }
  td.num {
    font-size: var(--fs-md);
  }
</style>
