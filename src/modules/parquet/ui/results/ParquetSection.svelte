<script lang="ts">
  /**
   * Section du parquet sur l'écran Résultats commun (pose, pièce ou projet) : plan coté de chaque pose (une pièce :
   * ses seules lames), fiche de coupe dans l'ordre de pose, plinthes, seuils, accès au chantier. Les prix se
   * règlent sur l'écran Achats.
   */
  import type { Polygon } from '../../../../core/geometry/types';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ResultSectionProps } from '../../../types';
  import type { Board } from '../../core/board';
  import { thresholdCuts } from '../../core/accessories';
  import { cuttingSheet } from '../../core/sheet';
  import type { ParquetResult } from '../../core/types';
  import { layoutsOf, parquetData } from '../../state/poses';
  import CutSketch from '../components/CutSketch.svelte';
  import ParquetPlan from '../components/ParquetPlan.svelte';
  import { scopedResult } from '../lib/results';
  import { groupTitle, itemText, skirtingCutText } from '../lib/sheetText';

  let { project, scope, result: raw }: ResultSectionProps = $props();

  const data = $derived(parquetData(project));
  const layouts = $derived(layoutsOf(project));
  const result = $derived(scopedResult(raw as ParquetResult, { project, scope }));
  const rooms = $derived(scope.kind === 'room' ? new Set([scope.room]) : null);
  const multi = $derived(result.layouts.length > 1);
  const roomName = (id: string) => project.plan.rooms.find((r) => r.id === id)?.name ?? 'Pièce';
  const layoutName = (id: string) => layouts.find((l) => l.id === id)?.name ?? 'Pose';
  const boards = $derived((app.libraries.boards ?? []) as readonly Board[]);
  const boardColor = (id: string) =>
    boards.find((b) => b.id === layouts.find((l) => l.id === id)?.boardId)?.color ?? '#c9a77c';
  /** Contours des pièces de la pose dessinées (une pièce : elle seule), repère du plan. */
  function roomsOf(id: string): Polygon[] {
    const l = layouts.find((x) => x.id === id);
    return (l?.rooms ?? [])
      .filter((r) => !rooms || rooms.has(r))
      .flatMap((rid) => {
        const r = project.plan.rooms.find((x) => x.id === rid);
        return r ? [r.outline.map(([x, y]): [number, number] => [r.origin[0] + x, r.origin[1] + y])] : [];
      });
  }
  const sheet = $derived(cuttingSheet(result, Object.fromEntries(layouts.map((l) => [l.id, l.rooms]))));
  const bars = $derived(
    result.skirting.plan
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => !rooms || b.cuts.some((c) => [...rooms].some((id) => c.id.startsWith(`${id}-`)))),
  );
  const seuils = $derived(
    data
      ? thresholdCuts(result, data.accessories.thresholds.barLength).flatMap((s) => {
          const p = s.passage ? project.plan.passages.find((x) => x.id === s.passage) : undefined;
          const where = p ? ` entre ${roomName(p.a.room)} et ${roomName(p.b.room)}` : '';
          return s.bars.map((b) => ({ ...b, where }));
        })
      : [],
  );
  const fr = (v: number) => v.toLocaleString('fr-FR');
</script>

{#if data && result.layouts.length}
  {#each result.layouts as lr (lr.id)}
    <section class="sec" aria-label="Plan coté — {layoutName(lr.id)}">
      <h3>Plan coté{multi ? ` — ${layoutName(lr.id)}` : ''}</h3>
      <div class="plan">
        <ParquetPlan
          rooms={roomsOf(lr.id)}
          pieces={lr.pieces}
          color={boardColor(lr.id)}
          variants={lr.pieces.some((p) => p.variant)}
          thresholds={lr.thresholds}
          dimensions
          label="Plan coté de {layoutName(lr.id)}"
        />
      </div>
      <ul class="legend" aria-label="Légende">
        <li><span class="sw" style="background: {boardColor(lr.id)}"></span>lame entière</li>
        <li><span class="sw cut"></span>lame coupée</li>
        <li><span class="sw reuse"></span>taillée dans une chute</li>
        <li>cotes intérieures en cm</li>
      </ul>
    </section>
  {/each}

  <section class="sec" aria-labelledby="p-sheet">
    <h3 id="p-sheet">Fiche de coupe, dans l’ordre de pose</h3>
    {#each sheet as g, gi (gi)}
      <h4>{multi ? `${layoutName(g.layout)} · ` : ''}{groupTitle(g, roomName)}</h4>
      <ul class="sheet">
        {#each g.items as it, i (i)}
          <li class:cut={it.kind === 'cut'}>
            {itemText(it, sheet, roomName)}
            {#if it.kind === 'cut' && it.shape && it.sameAs == null}<CutSketch
                shape={it.shape}
                angles={it.angles}
              />{/if}
          </li>
        {/each}
      </ul>
    {/each}
  </section>

  {#if bars.length}
    <section class="sec" aria-labelledby="p-skirting">
      <h3 id="p-skirting">Plinthes : {bars.length} barre{bars.length > 1 ? 's' : ''} de plinthe</h3>
      <ol class="bars">
        {#each bars as { b, i } (i)}
          <li>
            Barre de plinthe {i + 1} :
            {b.cuts.map((c) => skirtingCutText(c, roomName)).join(' + ')}{b.rest > 0 ? ` · reste ${fr(b.rest)} mm` : ''}
          </li>
        {/each}
      </ol>
      <p class="muted">
        Longueurs à couper, suppléments d’onglet compris.{rooms
          ? ' Une barre partagée avec une autre pièce est donnée entière.'
          : ''}
      </p>
    </section>
  {/if}
  {#if seuils.length}
    <section class="sec" aria-labelledby="p-thresholds">
      <h3 id="p-thresholds">Seuils : {seuils.length} barre{seuils.length > 1 ? 's' : ''} de seuil</h3>
      <ol class="bars">
        {#each seuils as b, i (i)}
          <li>Barre de seuil {i + 1} : {fr(b.length)} mm{b.where}{b.rest > 0 ? ` · reste ${fr(b.rest)} mm` : ''}</li>
        {/each}
      </ol>
    </section>
  {/if}
  <p><a href="#/p/{project.id}/m/parquet/chantier">Suivre le chantier du parquet</a></p>
{/if}

<style>
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
    margin: var(--space-2) 0 0;
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
  .bars {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-num);
  }
  .sheet li.cut {
    font-weight: 600;
  }
  .muted {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
</style>
