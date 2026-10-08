<script lang="ts">
  /**
   * Résultats du projet : chiffres clés, commande par carreau, plan de découpe numéroté.
   * (Phase 6 : encollage, liste d'achat avec prix, comparaison, export.)
   */
  import type { Piece, ProjectResult } from '../../core';
  import { projectArea, projectCost } from '../../state/pricing';
  import Button from '../components/Button.svelte';
  import DataTable from '../components/DataTable.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Screen from '../components/Screen.svelte';
  import StatCard from '../components/StatCard.svelte';
  import { app } from '../lib/app.svelte';
  import { euros, m2 } from '../lib/format';
  import { errorText, productName } from '../lib/messages';

  let { id }: { id: string } = $props();

  const project = $derived(app.project(id));
  let result = $state.raw<ProjectResult | null>(null);

  $effect(() => {
    const p = project;
    if (!p) return;
    let live = true;
    void app.result(p).then((r) => live && (result = r));
    return () => (live = false);
  });

  const cost = $derived(project && result ? projectCost(project, app.tiles, result) : null);
  const multi = $derived((project?.surfaces.length ?? 0) > 1);
  const SIDE = { L: 'tableau gauche', R: 'tableau droit', T: 'linteau', B: 'appui' };
  const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');

  /** « encoche 600 × 120 (F1 linteau) [Mur B] », comme le plan de découpe de legacy. */
  function pieceText(pc: Piece): string {
    const kind = pc.notch ? 'encoche ' : pc.rect ? '' : 'biais ';
    const extra = pc.plinth ? ' (plinthe)' : pc.reveal ? ` (F${pc.reveal.opening + 1} ${SIDE[pc.reveal.side]})` : '';
    const where = multi ? ` [${project!.surfaces[pc.surface]?.name}]` : '';
    return `${kind}${mm(pc.pw)} × ${mm(pc.ph)}${extra}${where}`;
  }
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title="Résultats — {project.name}" backHref="#/p/{project.id}" backLabel="Retour au plan">
    {#if !result}
      <p class="muted" role="status">Calcul…</p>
    {:else}
      <div class="res">
        {#each result.surfaces as s, i (i)}
          {#if !s.ok}<p class="err">{project.surfaces[i]?.name} : {errorText(s.error)}</p>{/if}
        {/each}
        <section class="stats" aria-label="Résumé">
          <StatCard label="À commander" value={result.metrics.order.toLocaleString('fr-FR')} unit="carreaux" />
          <StatCard label="Nécessaires" value={String(result.metrics.needed)} />
          <StatCard label="Coupes" value={String(result.metrics.cuts)} status="cut" />
          <StatCard label="Dans les chutes" value={String(result.metrics.reused)} status="reuse" />
          <StatCard
            label="Coupes fines"
            value={String(result.metrics.thin)}
            status={result.metrics.thin ? 'thin' : undefined}
          />
          <StatCard
            label="Coupes apparentes"
            value={String(result.metrics.vis)}
            status={result.metrics.vis ? 'thin' : undefined}
          />
          <StatCard
            label="Coupe la plus étroite"
            value={result.metrics.cuts ? mm(result.metrics.minCut) : '–'}
            unit={result.metrics.cuts ? 'mm' : ''}
          />
          <StatCard label="Surface" value={m2(projectArea(project)).replace(' m²', '')} unit="m²" />
          <StatCard label="Coût estimé" value={cost && cost.total > 0 ? euros(cost.total) : '–'} />
        </section>

        <section aria-labelledby="r-order">
          <h2 id="r-order">Commande{multi ? ', toutes surfaces' : ''}</h2>
          <DataTable
            caption="Commande par carreau"
            rows={result.plan.groups.map((g, i) => ({ g, o: result!.orders[i]! }))}
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
          <p class="muted">Marge de casse {project.settings.margin} % comprise.</p>
        </section>

        <section aria-labelledby="r-cuts">
          <h2 id="r-cuts">Plan de découpe</h2>
          {#if result.plan.groups.every((g) => !g.tiles.length)}
            <p class="muted">Aucune coupe.</p>
          {:else}
            <p class="muted">Les pièces de même numéro sortent du même carreau. Numéros identiques sur le plan.</p>
            {#each result.plan.groups.filter((g) => g.tiles.length) as g (g.key)}
              <h3>
                <span class="dot" style="background: {g.color}"></span>{productName(g.label)} — {g.tiles.length} carreaux
                à couper
              </h3>
              <ol class="cuts">
                {#each g.tiles as t (t.n)}
                  <li>
                    <strong class="num">n° {t.n}</strong>
                    <span>{t.pieces.map((i) => pieceText(result!.pieces[i]!)).join(' + ')}</span>
                  </li>
                {/each}
              </ol>
            {/each}
          {/if}
        </section>
      </div>
    {/if}
  </Screen>
{/if}

<style>
  .res {
    display: grid;
    gap: var(--space-5);
  }
  section {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .stats {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-2);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-md);
  }
  .dot {
    width: 14px;
    height: 14px;
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
  .cuts strong {
    font-size: var(--fs-md);
  }
  .muted {
    font-size: var(--fs-sm);
  }
  .err {
    color: var(--thin-ink);
  }
</style>
