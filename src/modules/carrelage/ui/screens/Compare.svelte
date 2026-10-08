<script lang="ts">
  import type { ModuleScreenProps } from '../../../types';
  /** Comparaison de deux scénarios A / B (ou d'un scénario et de l'état actuel), comme legacy. */
  import type { ProjectResult } from '../../core';
  import type { Scenario } from '../../state/model';
  import { projectCost } from '../../state/pricing';
  import { toProjectSpec } from '../../state/selectors';
  import Button from '../../../../ui/components/Button.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import PlanPreview from '../components/PlanPreview.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { carrelageView } from '../../state/data';
  import { dateShort } from '../../../../ui/lib/format';
  import { COMPARE_ROWS, compareValue, projectDescription, type CompareMetrics } from '../lib/labels';
  import { toast } from '../../../../ui/lib/toasts.svelte';

  let { projectId: id }: ModuleScreenProps = $props();

  const project = $derived(carrelage.view(id));
  let current = $state.raw<ProjectResult | null>(null);
  let scen = $state.raw<Record<'A' | 'B', Scenario | null>>({ A: null, B: null });
  let results = $state.raw<Record<string, ProjectResult>>({});
  let names = $state<Record<'A' | 'B', string>>({ A: '', B: '' });
  let confirm = $state<'A' | 'B' | null>(null);
  let version = $state(0);

  $effect(() => {
    const p = project;
    if (!p) return;
    let live = true;
    void carrelage.result(p).then((r) => live && (current = r));
    return () => (live = false);
  });

  $effect(() => {
    void version;
    let live = true;
    void carrelage.scenarios(id).then(async (list) => {
      if (!live) return;
      const next = { A: list.find((s) => s.slot === 'A') ?? null, B: list.find((s) => s.slot === 'B') ?? null };
      scen = next;
      names = { A: next.A?.name ?? '', B: next.B?.name ?? '' };
      const res: Record<string, ProjectResult> = {};
      for (const s of [next.A, next.B]) if (s) res[s.id] = await carrelage.scenarioResult(s);
      if (live) results = res;
    });
    return () => (live = false);
  });

  /** Vue carrelage de l'instantané d'un scénario. */
  const snap = (s: Scenario) => carrelageView(s.snapshot.project)!;

  function metricsOf(r: ProjectResult, s: Scenario | null): CompareMetrics {
    const p = s ? snap(s) : project!;
    const tiles = s ? s.snapshot.tiles : carrelage.tiles;
    return { ...r.metrics, cost: projectCost(p, tiles, r).total };
  }

  async function save(slot: 'A' | 'B') {
    if (!project || !current) return;
    const name = scen[slot]?.name || `Scénario ${slot}`;
    await carrelage.saveScenario(app.project(id)!, slot, name, current.metrics);
    toast(`État actuel enregistré dans le scénario ${slot}.`);
    version++;
  }

  async function clear(slot: 'A' | 'B') {
    const s = scen[slot];
    if (!s) return;
    await carrelage.deleteScenario(s);
    version++;
  }

  async function rename(slot: 'A' | 'B') {
    const s = scen[slot],
      n = names[slot].trim();
    if (!s || !n || n === s.name) return;
    await carrelage.renameScenario(s, n);
    version++;
  }

  async function load(slot: 'A' | 'B') {
    const s = scen[slot];
    confirm = null;
    if (!s) return;
    const prev = await carrelage.loadScenario(s);
    toast(`Scénario « ${s.name} » chargé.`, {
      action: prev ? { label: 'Annuler', run: () => void carrelage.restoreProject(prev) } : undefined,
    });
  }

  const left = $derived(scen.A ?? scen.B);
  const right = $derived(scen.A && scen.B ? scen.B : null);
  const L = $derived(left && results[left.id] ? metricsOf(results[left.id]!, left) : null);
  const R = $derived(
    right
      ? results[right.id]
        ? metricsOf(results[right.id]!, right)
        : null
      : current
        ? metricsOf(current, null)
        : null,
  );
  const fmt = (v: number, d: number) =>
    v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen
    title="Comparer — {project.name}"
    backHref="#/p/{project.id}/m/carrelage/results"
    backLabel="Retour aux résultats"
  >
    <p class="muted intro">
      Enregistrez l’état actuel dans A, modifiez le projet (motif, carreau, départ…), puis comparez avec B ou avec
      l’état actuel.
    </p>
    <div class="cards">
      {#each ['A', 'B'] as const as slot (slot)}
        {@const s = scen[slot]}
        <article class="card" aria-labelledby="sc-{slot}">
          <h2 id="sc-{slot}"><span class="tag">{slot}</span>{s ? s.name : `Scénario ${slot}`}</h2>
          {#if !s}
            <p class="muted">Aucun scénario enregistré.</p>
            <Button variant="primary" disabled={!current} onclick={() => save(slot)}>Enregistrer l’état actuel</Button>
          {:else}
            {@const r = results[s.id]}
            {@const first = r?.surfaces[0]}
            <div class="thumb">
              {#if r && first?.ok}
                <PlanPreview
                  surface={toProjectSpec(snap(s), s.snapshot.tiles).spec.surfaces[0]!}
                  pieces={first.value.pieces}
                  grout={snap(s).surfaces[0]?.zones[0]?.groutColor}
                  label="Aperçu du scénario {slot}"
                />
              {/if}
            </div>
            <TextField
              label="Nom du scénario {slot}"
              bind:value={names[slot]}
              maxlength={40}
              onchange={() => rename(slot)}
            />
            <p class="muted small">
              {projectDescription(snap(s), s.snapshot.tiles)}<br />Enregistré {dateShort(s.createdAt)}
            </p>
            <div class="row">
              <Button onclick={() => (confirm = slot)}>Charger</Button>
              <Button variant="ghost" disabled={!current} onclick={() => save(slot)}>Remplacer par l’actuel</Button>
              <Button variant="danger" icon="trash" onclick={() => clear(slot)}>Effacer</Button>
            </div>
          {/if}
        </article>
      {/each}
    </div>

    {#if left && L && R}
      <section aria-labelledby="cmp-t" class="cmp">
        <h2 id="cmp-t">Comparaison</h2>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="wrap" role="region" aria-label="Tableau de comparaison" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">Critère</th>
                <th scope="col" class="n">{left.name}</th>
                <th scope="col" class="n">{right ? right.name : 'État actuel'}</th>
                <th scope="col" class="n">Écart</th>
              </tr>
            </thead>
            <tbody>
              {#each COMPARE_ROWS as [label, key, dec, dir] (key)}
                {@const c = compareValue(L[key] || 0, R[key] || 0, dir)}
                <tr>
                  <th scope="row">{label}</th>
                  <td class="n num">{fmt(L[key] || 0, dec)}</td>
                  <td class="n num">{fmt(R[key] || 0, dec)}</td>
                  <td class="n num {c.verdict}">
                    {c.verdict === 'same' ? '=' : (c.delta > 0 ? '+' : '') + fmt(c.delta, dec)}
                    {#if c.verdict !== 'same'}<span class="visually-hidden"
                        >{c.verdict === 'better' ? '(mieux)' : '(moins bien)'}</span
                      >{/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  </Screen>

  <Dialog open={confirm != null} title="Charger le scénario {confirm ?? ''} ?" onclose={() => (confirm = null)}>
    <p>L’état actuel du projet sera remplacé par celui du scénario. Vous pourrez annuler juste après.</p>
    {#snippet actions()}
      <Button onclick={() => (confirm = null)}>Garder l’état actuel</Button>
      <Button variant="primary" onclick={() => confirm && load(confirm)}>Charger le scénario</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .intro {
    margin-bottom: var(--space-4);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: var(--space-3);
  }
  .card {
    display: grid;
    gap: var(--space-3);
    align-content: start;
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-lg);
  }
  .tag {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--ink);
    color: var(--paper);
    font-size: var(--fs-sm);
  }
  .thumb {
    height: 140px;
    display: grid;
    place-items: center;
    background: var(--paper);
    border-radius: var(--r-field);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .muted {
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .small {
    font-size: var(--fs-xs);
  }
  .cmp {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-5);
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
  }
  thead th {
    font-size: var(--fs-xs);
    color: var(--muted);
    background: var(--paper);
  }
  tbody th {
    font-weight: 500;
  }
  .n {
    text-align: right;
  }
  td.num {
    font-family: var(--font-num);
    font-size: var(--fs-md);
    white-space: nowrap;
  }
  .better {
    color: var(--better);
    font-weight: 600;
  }
  .worse {
    color: var(--thin-ink);
    font-weight: 600;
  }
</style>
