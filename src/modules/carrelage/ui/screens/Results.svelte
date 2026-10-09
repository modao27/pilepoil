<script lang="ts">
  import type { ModuleScreenProps } from '../../../types';
  /** Résultats du projet : onglets Commande, Découpe, Achats (prix modifiables), Encollage ; PDF et partage. */
  import type { ProjectResult } from '../../core';
  import { itemPrice, projectArea, projectCost } from '../../state/pricing';
  import Button from '../../../../ui/components/Button.svelte';
  import DataTable from '../../../../ui/components/DataTable.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import StatCard from '../../../../ui/components/StatCard.svelte';
  import Tabs from '../../../../ui/components/Tabs.svelte';
  import ExportDialog from '../components/ExportDialog.svelte';
  import { carrelage } from '../state.svelte';
  import { evaluate } from '../../../../ui/lib/calc';
  import { euros, m2 } from '../../../../ui/lib/format';
  import { glueRows, pieceCutText, shoppingLabel } from '../lib/labels';
  import { errorText, productName } from '../lib/messages';
  import { nameIn } from '../../state/surfaces';

  let { projectId: id }: ModuleScreenProps = $props();

  type Tab = 'order' | 'cuts' | 'shop' | 'glue';
  const project = $derived(carrelage.view(id));
  let result = $state.raw<ProjectResult | null>(null);
  let tab = $state<Tab>('order');
  let exporting = $state(false);

  $effect(() => {
    const p = project;
    if (!p) return;
    let live = true;
    void carrelage.result(p).then((r) => live && (result = r));
    return () => (live = false);
  });

  const cost = $derived(project && result ? projectCost(project, carrelage.tiles, result) : null);
  const multi = $derived((project?.surfaces.length ?? 0) > 1);
  /** Surfaces carrelées par pièce du plan. */
  const rooms = $derived(
    (project?.plan.rooms ?? [])
      .map((room) => ({ room, surfaces: project!.surfaces.filter((s) => s.parts.some((q) => q.ref.room === room.id)) }))
      .filter((g) => g.surfaces.length),
  );
  const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
  const tilesById = $derived(new Map(carrelage.tiles.map((t) => [t.id, t])));

  const shop = $derived(
    project && result
      ? result.shopping.map((it) => {
          const own = project.prices[it.key];
          const price = itemPrice(it, project, tilesById, result!);
          return {
            it,
            l: shoppingLabel(it, result!.plan.groups),
            own: own != null && own > 0,
            price,
            total: price != null ? price * it.mult : null,
          };
        })
      : [],
  );

  function onPrice(key: string, raw: string) {
    const v = raw.trim() === '' ? null : evaluate(raw);
    if (v === null && raw.trim() !== '') return;
    void carrelage.setPrice(id, key, v != null && v > 0 ? Math.round(v * 100) / 100 : null);
  }
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title="Résultats — {project.name}" backHref="#/p/{project.id}/m/carrelage" backLabel="Carrelage">
    {#snippet actions()}
      <Button variant="ghost" href="#/p/{project.id}/m/carrelage/compare">Comparer</Button>
      <Button icon="download" disabled={!result} onclick={() => (exporting = true)}>PDF</Button>
    {/snippet}
    {#if !result}
      <p class="muted" role="status">Calcul…</p>
    {:else}
      <div class="res">
        {#each result.surfaces as s, i (i)}
          {#if !s.ok}<p class="err">{project.surfaces[i]?.name} : {errorText(s.error)}</p>{/if}
        {/each}
        <section class="stats" aria-label="Résumé">
          <StatCard label="À commander" value={result.metrics.order.toLocaleString('fr-FR')} unit="carreaux" />
          <StatCard label="Coupes" value={String(result.metrics.cuts)} status="cut" />
          <StatCard label="Dans les chutes" value={String(result.metrics.reused)} status="reuse" />
          <StatCard
            label="Coupes fines"
            value={String(result.metrics.thin)}
            status={result.metrics.thin ? 'thin' : undefined}
          />
          <StatCard label="Surface" value={m2(projectArea(project)).replace(' m²', '')} unit="m²" />
          <StatCard label="Coût estimé" value={cost && cost.total > 0 ? euros(cost.total) : '–'} />
        </section>

        <section class="rooms" aria-label="Surfaces carrelées">
          {#each rooms as g (g.room.id)}
            <p>
              <strong>{g.room.name}</strong> :
              {#each g.surfaces as s, k (s.id)}{k ? ', ' : ''}<a href="#/p/{project.id}/m/carrelage/s/{s.id}"
                  >{nameIn(s, g.room)}</a
                >{/each}
              · <a href="#/p/{project.id}/m/carrelage/room/{g.room.id}">vue de la pièce</a>
            </p>
          {/each}
        </section>

        <Tabs
          label="Résultats"
          bind:active={tab}
          tabs={[
            { id: 'order', label: 'Commande' },
            { id: 'cuts', label: 'Découpe' },
            { id: 'shop', label: 'Achats' },
            { id: 'glue', label: 'Encollage' },
          ]}
        >
          {#snippet panel(t)}
            {#if t === 'order'}
              <section class="sec" aria-labelledby="r-order">
                <h2 id="r-order">Commande{multi ? ', toutes surfaces' : ''}</h2>
                <DataTable
                  caption="Commande par carreau"
                  rows={result!.plan.groups.map((g, i) => ({ g, o: result!.orders[i]! }))}
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
                    {
                      key: 'boxes',
                      label: 'Cartons',
                      numeric: true,
                      cell: (r) => (r.o.boxes ? String(r.o.boxes) : '–'),
                    },
                  ]}
                />
                <dl class="facts">
                  <div>
                    <dt>Coupes apparentes</dt>
                    <dd class="num">{result!.metrics.vis}</dd>
                  </div>
                  <div>
                    <dt>Coupe la plus étroite</dt>
                    <dd class="num">{result!.metrics.cuts ? mm(result!.metrics.minCut) + ' mm' : 'aucune'}</dd>
                  </div>
                  <div>
                    <dt>Marge de casse</dt>
                    <dd class="num">{project.settings.margin} %</dd>
                  </div>
                </dl>
                <p class="muted">
                  Nécessaires : carreaux entiers et carreaux entamés pour les coupes. À commander : avec la marge de
                  casse, arrondi au carreau puis au carton.
                </p>
              </section>
            {:else if t === 'cuts'}
              <section class="sec" aria-labelledby="r-cuts">
                <h2 id="r-cuts">Plan de découpe</h2>
                {#if result!.plan.groups.every((g) => !g.tiles.length)}
                  <p class="muted">Aucune coupe.</p>
                {:else}
                  <p class="muted">
                    Les pièces de même numéro sortent du même carreau. Les numéros sont les mêmes sur le plan.
                  </p>
                  {#each result!.plan.groups.filter((g) => g.tiles.length) as g (g.key)}
                    <h3>
                      <span class="dot" style="background: {g.color}"></span>{productName(g.label)} — {g.tiles.length} carreaux
                      à couper
                    </h3>
                    <ol class="cuts">
                      {#each g.tiles as tt (tt.n)}
                        <li>
                          <strong class="num">n° {tt.n}</strong>
                          <span>{tt.pieces.map((i) => pieceCutText(result!.pieces[i]!, project)).join(' + ')}</span>
                        </li>
                      {/each}
                    </ol>
                  {/each}
                {/if}
              </section>
            {:else if t === 'shop'}
              <section class="sec" aria-labelledby="r-shop">
                <h2 id="r-shop">Liste d’achat</h2>
                <!-- Zone défilante focalisable : défilement horizontal au clavier sur mobile. -->
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <div class="wrap" role="region" aria-label="Liste d’achat" tabindex="0">
                  <table>
                    <thead>
                      <tr
                        ><th scope="col">Article</th><th scope="col">Quantité</th><th scope="col" class="n"
                          >Prix unitaire</th
                        ><th scope="col" class="n">Total</th></tr
                      >
                    </thead>
                    <tbody>
                      {#each shop as s (s.it.key)}
                        <tr>
                          <td>
                            {#if s.l.dot}<span class="dot" style="background: {s.l.dot}"></span>{/if}{s.l.label}
                          </td>
                          <td>{s.l.qty}</td>
                          <td class="n">
                            <span class="price">
                              <input
                                type="text"
                                inputmode="decimal"
                                aria-label="Prix {s.l.label} en {s.l.unit}"
                                value={s.own && s.price != null ? String(s.price).replace('.', ',') : ''}
                                placeholder={!s.own && s.price != null ? String(s.price).replace('.', ',') : s.l.unit}
                                onchange={(e) => onPrice(s.it.key, e.currentTarget.value)}
                              />
                              <span class="u">{s.l.unit}</span>
                            </span>
                          </td>
                          <td class="n num">{s.total != null ? euros(s.total) : '–'}</td>
                        </tr>
                      {/each}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="3"
                          >Total estimé{cost && cost.unpriced
                            ? ` (${cost.unpriced} article${cost.unpriced > 1 ? 's' : ''} sans prix)`
                            : ''}</td
                        >
                        <td class="n num">{cost && cost.total > 0 ? euros(cost.total) : '–'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p class="muted">
                  Quantités arrondies au conditionnement, marge de casse incluse. Joint : (L + l) / (L × l) × épaisseur
                  × largeur de joint × 1,6. Croisillons, cales, primaire et silicone sont des estimations. Le prix au m²
                  des carreaux vient de la bibliothèque ; saisissez un prix pour le remplacer dans ce projet.
                </p>
              </section>
            {:else}
              <section class="sec" aria-labelledby="r-glue">
                <h2 id="r-glue">Encollage (indicatif)</h2>
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <div class="wrap" role="region" aria-label="Encollage" tabindex="0">
                  <table>
                    <thead>
                      <tr
                        ><th scope="col">Bande</th><th scope="col">Carreau</th><th scope="col">Spatule crantée</th><th
                          scope="col">Encollage</th
                        ><th scope="col" class="n">Colle estimée</th></tr
                      >
                    </thead>
                    <tbody>
                      {#each glueRows(project, result!) as g, i (i)}
                        <tr>
                          <td>{g.where}</td>
                          <td>{g.tile}<br /><small class="muted">{g.size}</small></td>
                          <td>{g.notch}</td>
                          <td
                            ><strong class:dbl={g.double}>{g.mode}</strong>{#if g.note}<br /><small class="muted"
                                >{g.note}</small
                              >{/if}</td
                          >
                          <td class="n num">{g.kg}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
                <p class="muted">
                  Repères issus du NF DTU 52.2 et des fiches techniques de mortiers-colles, pour une pose intérieure sur
                  support plan. La fiche du mortier-colle choisi et la notice du fabricant de carreaux restent
                  prioritaires.
                </p>
              </section>
            {/if}
          {/snippet}
        </Tabs>
      </div>
    {/if}
  </Screen>
  {#if result}<ExportDialog bind:open={exporting} {project} {result} />{/if}
{/if}

<style>
  .res {
    display: grid;
    gap: var(--space-4);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-2);
  }
  .sec {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-md);
  }
  .dot {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: var(--space-2);
    border-radius: 3px;
    border: 1px solid var(--field-border);
    vertical-align: -2px;
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
  .cuts strong {
    font-size: var(--fs-md);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0;
  }
  .facts div {
    display: grid;
  }
  dt {
    font-size: var(--fs-xs);
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 600;
  }
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
    border-bottom: 1px solid var(--line);
    vertical-align: middle;
  }
  th {
    font-size: var(--fs-xs);
    color: var(--muted);
    background: var(--paper);
    white-space: nowrap;
  }
  tfoot td {
    font-weight: 600;
    border-bottom: 0;
  }
  .n {
    text-align: right;
  }
  td.num {
    font-family: var(--font-num);
    font-size: var(--fs-md);
    white-space: nowrap;
  }
  .price {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .price input {
    width: 88px;
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    font-family: var(--font-num);
    font-size: var(--fs-md);
    text-align: right;
  }
  .u {
    font-size: var(--fs-xs);
    color: var(--muted);
    white-space: nowrap;
  }
  .muted {
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  small.muted {
    font-size: var(--fs-xs);
  }
  .dbl {
    color: var(--thin-ink);
  }
  .err {
    color: var(--thin-ink);
  }
  .rooms p {
    margin: 0;
    line-height: 2;
  }
</style>
