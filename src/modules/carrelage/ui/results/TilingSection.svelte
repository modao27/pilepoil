<script lang="ts">
  /**
   * Section du carrelage sur l'écran Résultats commun (pose, pièce ou projet) : commande des carreaux, plan de
   * découpe des pièces de la portée, encollage. Les prix se règlent sur l'écran Achats.
   */
  import DataTable from '../../../../ui/components/DataTable.svelte';
  import type { ResultSectionProps } from '../../../types';
  import type { ProjectResult } from '../../core';
  import { carrelageView } from '../../state/data';
  import { scopePieces, scopeSurfaces } from '../../state/results';
  import { glueRows, pieceCutText } from '../lib/labels';
  import { productName } from '../lib/messages';

  let { project: doc, scope, result: raw }: ResultSectionProps = $props();

  const result = $derived(raw as ProjectResult);
  const project = $derived(carrelageView(doc));
  const own = $derived(new Set(project ? scopeSurfaces(project, scope) : []));
  const pieces = $derived(project ? scopePieces(project, result, scope) : new Set<number>());
  const orders = $derived(
    result.plan.groups
      .map((g, i) => ({ g, o: result.orders[i]! }))
      .filter(({ g }) => g.zones.some((z) => own.has(z.surface))),
  );
  const shared = $derived(orders.some(({ g }) => g.zones.some((z) => !own.has(z.surface))));
  const cuts = $derived(
    result.plan.groups
      .map((g) => ({ g, tiles: g.tiles.filter((t) => t.pieces.some((i) => pieces.has(i))) }))
      .filter((x) => x.tiles.length),
  );
  const glue = $derived(project ? glueRows(project, result).filter((_, i) => own.has(result.glue[i]!.surface)) : []);
</script>

{#if project && own.size}
  <section class="sec" aria-labelledby="t-order">
    <h3 id="t-order">Commande des carreaux</h3>
    <DataTable
      caption="Commande par carreau"
      rows={orders}
      columns={[
        { key: 'p', label: 'Carreau', cell: (r) => productName(r.g.label) },
        { key: 'posed', label: 'Posés', numeric: true, cell: (r) => String(r.o.posed) },
        { key: 'needed', label: 'Nécessaires', numeric: true, cell: (r) => String(r.o.needed) },
        { key: 'order', label: 'À commander', numeric: true, cell: (r) => String(r.o.order) },
        {
          key: 'm2',
          label: 'm²',
          numeric: true,
          cell: (r) => r.o.m2.toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
        },
        { key: 'boxes', label: 'Cartons', numeric: true, cell: (r) => (r.o.boxes ? String(r.o.boxes) : '–') },
      ]}
    />
    <p class="muted">
      Marge de casse de {project.settings.margin} % comprise, arrondi au carreau puis au carton.{shared
        ? ' Quantités pour tout le projet : les chutes passent d’une pose à l’autre.'
        : ''}
    </p>
  </section>

  <section class="sec" aria-labelledby="t-cuts">
    <h3 id="t-cuts">Plan de découpe</h3>
    {#if !cuts.length}
      <p class="muted">Aucune coupe.</p>
    {:else}
      <p class="muted">Les pièces de même numéro sortent du même carreau.</p>
      {#each cuts as c (c.g.key)}
        <h4>
          <span class="dot" style="background: {c.g.color}"></span>{productName(c.g.label)} — {c.tiles.length} carreaux à
          couper
        </h4>
        <ol class="cuts">
          {#each c.tiles as tt (tt.n)}
            <li>
              <strong class="num">n° {tt.n}</strong>
              <span>{tt.pieces.map((i) => pieceCutText(result.pieces[i]!, project)).join(' + ')}</span>
            </li>
          {/each}
        </ol>
      {/each}
    {/if}
  </section>

  {#if glue.length}
    <section class="sec" aria-labelledby="t-glue">
      <h3 id="t-glue">Encollage (indicatif)</h3>
      <DataTable
        caption="Encollage"
        rows={glue}
        columns={[
          { key: 'w', label: 'Bande', cell: (g) => g.where },
          { key: 't', label: 'Carreau', cell: (g) => `${g.tile} (${g.size})` },
          { key: 'n', label: 'Spatule crantée', cell: (g) => g.notch },
          { key: 'm', label: 'Encollage', cell: (g) => (g.note ? `${g.mode} — ${g.note}` : g.mode) },
          { key: 'kg', label: 'Colle estimée', numeric: true, cell: (g) => g.kg },
        ]}
      />
      <p class="muted">
        Repères issus du NF DTU 52.2 et des fiches techniques de mortiers-colles, pour une pose intérieure sur support
        plan. La fiche du mortier-colle et la notice du fabricant restent prioritaires.
      </p>
    </section>
  {/if}
  {#if scope.kind === 'project'}
    <p><a href="#/p/{doc.id}/m/carrelage/compare">Comparer deux versions du carrelage</a></p>
  {/if}
{/if}

<style>
  /* cible tactile de 44 px */
  a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }
  .sec {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  h3 {
    margin: 0;
    font-size: var(--fs-md);
  }
  h4 {
    display: flex;
    align-items: center;
    margin: var(--space-2) 0 0;
    font-size: var(--fs-base);
  }
  .dot {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: var(--space-2);
    border-radius: 3px;
    border: 1px solid var(--field-border);
  }
  .cuts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: var(--fs-sm);
  }
  .cuts li {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--sheet);
    border-radius: 6px;
  }
  .muted {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
</style>
