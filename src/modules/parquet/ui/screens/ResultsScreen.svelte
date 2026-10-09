<script lang="ts">
  /**
   * Résultats du parquet (#/p/:id/m/parquet/results) : chiffres clés, alertes, onglets Plan (plan coté de
   * chaque pose), Coupes (fiche de coupe dans l'ordre de pose, plinthes), Achats ; export PDF.
   */
  import type { Polygon } from '../../../../core/geometry/types';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import StatCard from '../../../../ui/components/StatCard.svelte';
  import Tabs from '../../../../ui/components/Tabs.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { euros } from '../../../../ui/lib/format';
  import { lineCost } from '../../../../ui/lib/shopping';
  import type { ModuleScreenProps } from '../../../types';
  import type { Board } from '../../core/board';
  import { thresholdCuts } from '../../core/accessories';
  import { cuttingSheet } from '../../core/sheet';
  import type { ParquetResult } from '../../core/types';
  import { PARQUET_ID } from '../../state/model';
  import { parquetData, shopping, toSpec } from '../../state/module';
  import ParquetPlan from '../components/ParquetPlan.svelte';
  import { errorText, warningText } from '../lib/messages';
  import { groupTitle, itemText, quantityText, skirtingCutText } from '../lib/sheetText';

  let { projectId }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
  let result = $state.raw<ParquetResult | null>(null);
  let failed = $state(false);
  let tab = $state<'plan' | 'cuts' | 'shop'>('plan');
  let exporting = $state(false);

  $effect(() => {
    const p = project;
    void app.libraries;
    if (!p || !parquetData(p)) return;
    const r = toSpec(p, app.libraries);
    if ('errors' in r) {
      failed = true;
      return;
    }
    let live = true;
    void app.queued<ParquetResult>(PARQUET_ID, r.spec).then((x) => live && ((result = x), (failed = false)));
    return () => (live = false);
  });

  const data = $derived(project ? parquetData(project) : null);
  const lines = $derived(result && data ? shopping(result, data, app.libraries) : []);
  const cost = $derived(lines.reduce((t, l) => t + (lineCost(l) ?? 0), 0));
  const roomName = (id: string) => project?.plan.rooms.find((r) => r.id === id)?.name ?? 'Pièce';
  const layoutName = (id: string) => data?.layouts.find((l) => l.id === id)?.name ?? 'Pose';
  const sheet = $derived(
    result && data ? cuttingSheet(result, Object.fromEntries(data.layouts.map((l) => [l.id, l.rooms]))) : [],
  );
  const seuils = $derived(result && data ? thresholdCuts(result, data.accessories.thresholds.barLength) : []);
  const seuilBars = $derived(
    seuils.flatMap((s) => {
      const p = s.passage ? project?.plan.passages.find((x) => x.id === s.passage) : undefined;
      const where = p ? ` entre ${roomName(p.a.room)} et ${roomName(p.b.room)}` : '';
      return s.bars.map((b) => ({ ...b, where }));
    }),
  );
  const multi = $derived((result?.layouts.length ?? 0) > 1);
  const boards = $derived((app.libraries.boards ?? []) as readonly Board[]);
  const boardColor = (layoutId: string) =>
    boards.find((b) => b.id === data?.layouts.find((l) => l.id === layoutId)?.boardId)?.color ?? '#c9a77c';
  function roomsOf(layoutId: string): Polygon[] {
    const l = data?.layouts.find((x) => x.id === layoutId);
    return (l?.rooms ?? []).flatMap((id) => {
      const r = project?.plan.rooms.find((x) => x.id === id);
      return r ? [r.outline.map(([x, y]): [number, number] => [r.origin[0] + x, r.origin[1] + y])] : [];
    });
  }
  const fr = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

  async function exportPdf() {
    if (!result || !project || !data) return;
    exporting = true;
    try {
      const { buildParquetPdf } = await import('../lib/pdf');
      const blob = buildParquetPdf({ project, data, result, lines, boards, date: Date.now() });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${project.name} - parquet.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } finally {
      exporting = false;
    }
  }
</script>

<Screen
  title="Résultats — {project?.name ?? 'Parquet'}"
  backHref="#/p/{projectId}/m/parquet"
  backLabel="Retour au parquet"
>
  {#if failed}
    <EmptyState icon="info" title="Rien à calculer" text="Choisissez au moins une pièce du plan dans l’éditeur." />
  {:else if !result}
    <p class="muted" role="status">Calcul…</p>
  {:else}
    <section class="stats" aria-label="Résumé">
      <StatCard label="Surface posable" value={fr(result.totals.area, 2)} unit="m²" />
      <StatCard label="Lames utilisées" value={fr(result.totals.boards)} />
      <StatCard label="Paquets" value={fr(lines.reduce((t, l) => t + (l.unit === 'pack' ? l.quantity : 0), 0))} />
      <StatCard
        label="Perte"
        value={fr(result.totals.wastePct, 1)}
        unit="%"
        status={result.totals.wastePct > 10 ? 'cut' : undefined}
      />
      <StatCard label="Lames coupées" value={fr(result.totals.cuts)} status="cut" />
      <StatCard label="Coût estimé" value={cost > 0 ? euros(cost) : '–'} />
    </section>

    {#each result.layouts as lr (lr.id)}
      {#if lr.errors.length || lr.warnings.length}
        <ul class="alerts" aria-label="Alertes{multi ? ` — ${layoutName(lr.id)}` : ''}">
          {#each lr.errors as e, i (i)}<li class="err">{errorText(e)}</li>{/each}
          {#each [...new Set(lr.warnings.map(warningText))] as w (w)}<li>{w}</li>{/each}
        </ul>
      {/if}
    {/each}

    <div class="actions">
      <Button variant="secondary" icon="download" onclick={() => void exportPdf()} disabled={exporting}>
        {exporting ? 'Préparation…' : 'Exporter en PDF'}
      </Button>
    </div>

    <Tabs
      label="Résultats"
      bind:active={tab}
      tabs={[
        { id: 'plan', label: 'Plan' },
        { id: 'cuts', label: 'Coupes' },
        { id: 'shop', label: 'Achats' },
      ]}
    >
      {#snippet panel(t)}
        {#if t === 'plan'}
          {#each result!.layouts as lr (lr.id)}
            <section class="sec" aria-label="Plan{multi ? ` — ${layoutName(lr.id)}` : ''}">
              {#if multi}<h2>{layoutName(lr.id)}</h2>{/if}
              <div class="plan">
                <ParquetPlan
                  rooms={roomsOf(lr.id)}
                  pieces={lr.pieces}
                  color={boardColor(lr.id)}
                  variants={lr.pieces.some((p) => p.variant)}
                  thresholds={lr.thresholds}
                  dimensions
                  label="Plan coté{multi ? ` de ${layoutName(lr.id)}` : ''}"
                />
              </div>
              <ul class="legend" aria-label="Légende">
                <li><span class="sw full" style="background: {boardColor(lr.id)}"></span>lame entière</li>
                <li><span class="sw cut"></span>lame coupée</li>
                <li><span class="sw reuse"></span>taillée dans une chute</li>
                <li>cotes intérieures en cm</li>
              </ul>
            </section>
          {/each}
        {:else if t === 'cuts'}
          <section class="sec" aria-labelledby="r-sheet">
            <h2 id="r-sheet">Fiche de coupe, dans l’ordre de pose</h2>
            {#each sheet as g, gi (gi)}
              <h3>{multi ? `${layoutName(g.layout)} · ` : ''}{groupTitle(g, roomName)}</h3>
              <ul class="sheet">
                {#each g.items as it, i (i)}
                  <li class:cut={it.kind === 'cut'}>{itemText(it, sheet, roomName)}</li>
                {/each}
              </ul>
            {/each}
          </section>
          {#if result!.skirting.bars}
            <section class="sec" aria-labelledby="r-skirting">
              <h2 id="r-skirting">
                Plinthes : {result!.skirting.bars} barre{result!.skirting.bars > 1 ? 's' : ''} de plinthe
              </h2>
              <ol class="bars">
                {#each result!.skirting.plan as b, i (i)}
                  <li>
                    Barre de plinthe {i + 1} :
                    {b.cuts.map((c) => skirtingCutText(c, roomName)).join(' + ')}{b.rest > 0
                      ? ` · reste ${fr(b.rest)} mm`
                      : ''}
                  </li>
                {/each}
              </ol>
              <p class="muted">Longueurs à couper, suppléments d’onglet compris.</p>
            </section>
          {/if}
          {#if seuils.length}
            <section class="sec" aria-labelledby="r-thresholds">
              <h2 id="r-thresholds">
                Seuils : {seuilBars.length} barre{seuilBars.length > 1 ? 's' : ''} de seuil
              </h2>
              <ol class="bars">
                {#each seuilBars as b, i (i)}
                  <li>
                    Barre de seuil {i + 1} : {fr(b.length)} mm{b.where}{b.rest > 0 ? ` · reste ${fr(b.rest)} mm` : ''}
                  </li>
                {/each}
              </ol>
            </section>
          {/if}
        {:else}
          <section class="sec" aria-labelledby="r-shop">
            <h2 id="r-shop">Achats du parquet</h2>
            <ul class="shop">
              {#each lines as l (l.key)}
                <li>
                  <strong>{l.label}</strong> : {quantityText(l)}
                  {#if lineCost(l) != null}<span class="num"> · {euros(lineCost(l)!)}</span>{/if}
                  <br /><small class="muted">{l.detail}</small>
                </li>
              {/each}
            </ul>
            <p><a href="#/p/{projectId}/achats">Liste d’achat du projet et prix</a></p>
          </section>
        {/if}
      {/snippet}
    </Tabs>
  {/if}
</Screen>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .muted {
    color: var(--muted);
  }
  .alerts {
    padding-left: var(--space-5);
  }
  .err {
    color: var(--thin);
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .sec {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-md);
  }
  h3 {
    margin: var(--space-3) 0 0;
    font-size: var(--fs-base);
  }
  .plan {
    height: min(60vh, 520px);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    overflow: hidden;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--fs-sm);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .sw {
    width: 16px;
    height: 12px;
    border: 1px solid var(--ink);
  }
  .sw.cut {
    background: color-mix(in srgb, var(--cut) 70%, var(--sheet));
  }
  .sw.reuse {
    background: color-mix(in srgb, var(--reuse) 70%, var(--sheet));
  }
  .sheet,
  .bars,
  .shop {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding-left: var(--space-4);
  }
  .sheet,
  .bars {
    list-style: none;
    padding-left: 0;
    font-family: var(--font-num);
  }
  .sheet li.cut {
    font-weight: 600;
  }
  .shop {
    list-style: none;
    padding-left: 0;
    gap: var(--space-3);
  }
</style>
