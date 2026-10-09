<script lang="ts">
  /**
   * Chantier (#/p/:id/m/parquet/chantier) : un rang ou une ligne à la fois, dans l'ordre de la fiche de coupe ;
   * grandes cases à cocher, mini-plan, progression. Ce qui est coché est gardé dans `worksite` avec l'empreinte du
   * calcul (tout reste sur l'appareil : hors ligne). Calcul changé : garder ce qui existe encore ou repartir de zéro.
   */
  import { onMount, untrack } from 'svelte';
  import type { Polygon } from '../../../../core/geometry/types';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ModuleScreenProps } from '../../../types';
  import type { Board } from '../../core/board';
  import { cuttingSheet, type SheetItem } from '../../core/sheet';
  import ParquetPlan from '../components/ParquetPlan.svelte';
  import { ParquetEditorState } from '../editorState.svelte';
  import { groupTitle, itemText } from '../lib/sheetText';

  let { projectId }: ModuleScreenProps = $props();
  const initial = untrack(() => app.project(projectId));
  const ed = initial ? new ParquetEditorState(initial) : null;

  // projet modifié ailleurs (éditeur, autre onglet) : on reprend la version enregistrée la plus récente
  $effect(() => {
    const ext = app.project(projectId);
    if (!ed || !ext) return;
    const own = untrack(() => ed.doc);
    if (ext !== own && ext.updatedAt > own.updatedAt) ed.store.reset(ext);
  });

  $effect(() => {
    if (!ed) return;
    void ed.doc;
    void app.libraries;
    void ed.recompute();
  });

  const data = $derived(ed?.data);
  const result = $derived(ed?.result ?? null);
  const roomName = (id: string) => ed?.doc.plan.rooms.find((r) => r.id === id)?.name ?? 'Pièce';
  const layoutName = (id: string) => data?.layouts.find((l) => l.id === id)?.name ?? 'Pose';
  const sheet = $derived(
    result && data ? cuttingSheet(result, Object.fromEntries(data.layouts.map((l) => [l.id, l.rooms]))) : [],
  );
  const multi = $derived((result?.layouts.length ?? 0) > 1);
  const total = $derived(result?.layouts.reduce((t, l) => t + l.pieces.length, 0) ?? 0);

  /** Pièces cochées valables pour ce calcul ; calcul changé avec des pièces cochées : à trancher. */
  const ws = $derived(data?.worksite ?? null);
  const stale = $derived(!!result && !!ws && ws.resultHash !== result.hash && ws.done.length > 0);
  const done = $derived(new Set(result && ws && ws.resultHash === result.hash ? ws.done : []));
  const pct = $derived(total ? Math.round((done.size / total) * 100) : 0);

  const ids = (it: SheetItem) => (it.kind === 'full' ? it.ids : [it.id]);
  const isDone = (it: SheetItem) => ids(it).every((id) => done.has(id));
  const groupDone = (gi: number) => !!sheet[gi]?.items.every(isDone);

  // rang affiché : retenu sur cet appareil (commodité), sinon le premier rang pas fini
  const storeKey = untrack(() => `pilepoil:chantier:${projectId}`);
  let current = $state(0);
  let placed = false;
  $effect(() => {
    if (placed || !sheet.length) return;
    placed = true;
    let saved = -1;
    try {
      saved = Number(localStorage.getItem(storeKey) ?? -1);
    } catch {
      // stockage du navigateur indisponible : sans importance
    }
    const firstOpen = untrack(() => sheet.findIndex((_, gi) => !groupDone(gi)));
    current = saved >= 0 && saved < sheet.length ? saved : Math.max(0, firstOpen);
  });
  $effect(() => {
    const c = current;
    // pas avant d'avoir repris le rang retenu (sinon on l'écraserait avec le rang 1)
    if (!placed) return;
    try {
      localStorage.setItem(storeKey, String(c));
    } catch {
      // idem
    }
  });
  const group = $derived(sheet[Math.min(current, Math.max(0, sheet.length - 1))]);
  const focus = $derived(new Set(group?.items.flatMap(ids) ?? []));

  function mark(list: string[], on: boolean) {
    if (ed && result) ed.dispatch({ type: 'parquet/worksite/mark', hash: result.hash, ids: list, done: on });
  }
  function keepValid() {
    if (!ed || !result) return;
    const valid = result.layouts.flatMap((l) => l.pieces.map((p) => p.id));
    ed.dispatch({ type: 'parquet/worksite/rebase', hash: result.hash, valid });
  }
  function restart() {
    if (ed && result) ed.dispatch({ type: 'parquet/worksite/rebase', hash: result.hash, valid: [] });
  }

  function roomsOf(layoutId: string): Polygon[] {
    const l = data?.layouts.find((x) => x.id === layoutId);
    return (l?.rooms ?? []).flatMap((id) => {
      const r = ed?.doc.plan.rooms.find((x) => x.id === id);
      return r ? [r.outline.map(([x, y]): [number, number] => [r.origin[0] + x, r.origin[1] + y])] : [];
    });
  }
  const layoutResult = $derived(result?.layouts.find((l) => l.id === group?.layout));
  const color = $derived(
    ((app.libraries.boards ?? []) as readonly Board[]).find(
      (b) => b.id === data?.layouts.find((l) => l.id === group?.layout)?.boardId,
    )?.color ?? '#c9a77c',
  );

  onMount(() => {
    const flush = () => void ed?.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  });
</script>

<Screen
  title="Chantier — {ed?.doc.name ?? 'Parquet'}"
  backHref="#/p/{projectId}/m/parquet/results"
  backLabel="Retour aux résultats"
>
  {#if !ed || !data}
    <EmptyState icon="info" title="Projet introuvable" text="Revenez à l’accueil pour ouvrir un projet." />
  {:else if !result}
    <p class="muted" role="status">Calcul…</p>
  {:else if !sheet.length}
    <EmptyState icon="info" title="Rien à poser" text="Choisissez au moins une pièce du plan dans l’éditeur." />
  {:else}
    {#if stale}
      <section class="stale" role="alert">
        <p>
          Le calcul a changé depuis le début du chantier (lame, motif ou pièces modifiés). Les numéros des pièces ont pu
          changer.
        </p>
        <div class="row">
          <Button variant="primary" onclick={keepValid}>Garder ce qui existe encore</Button>
          <Button variant="secondary" onclick={restart}>Repartir de zéro</Button>
        </div>
      </section>
    {/if}

    <section class="progress" aria-label="Progression">
      <p><strong>{done.size} / {total} pièces posées</strong> · {pct} %</p>
      <progress max={total} value={done.size}>{pct} %</progress>
    </section>

    {#if group}
      <section class="group" aria-labelledby="ws-title">
        <h2 id="ws-title">
          {multi ? `${layoutName(group.layout)} · ` : ''}{groupTitle(group, roomName)}
          <small>({current + 1} / {sheet.length})</small>
        </h2>
        <div class="mini">
          <ParquetPlan
            rooms={roomsOf(group.layout)}
            pieces={layoutResult?.pieces ?? []}
            {color}
            {focus}
            {done}
            label="Plan : {groupTitle(group, roomName)} en évidence, pièces posées en gris"
          />
        </div>
        <ul class="items">
          {#each group.items as it, i (i)}
            <li>
              <label class="item" class:checked={isDone(it)}>
                <input type="checkbox" checked={isDone(it)} onchange={(e) => mark(ids(it), e.currentTarget.checked)} />
                <span>{itemText(it, sheet, roomName)}</span>
              </label>
            </li>
          {/each}
        </ul>
        <Button variant="secondary" disabled={groupDone(current)} onclick={() => mark([...focus], true)}>
          {group.kind === 'row' ? 'Tout ce rang est posé' : 'Toute cette ligne est posée'}
        </Button>
      </section>

      <nav class="nav" aria-label="Rangs">
        <Button variant="secondary" icon="back" disabled={current === 0} onclick={() => (current -= 1)}>
          {group.kind === 'row' ? 'Rang précédent' : 'Ligne précédente'}
        </Button>
        <Button variant="primary" disabled={current >= sheet.length - 1} onclick={() => (current += 1)}>
          {group.kind === 'row' ? 'Rang suivant' : 'Ligne suivante'}
        </Button>
      </nav>
    {/if}
  {/if}
</Screen>

<style>
  .muted {
    color: var(--muted);
  }
  .stale {
    display: grid;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    padding: var(--space-3);
    border-left: 4px solid var(--cut);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--cut) 12%, var(--sheet));
  }
  .stale p {
    margin: 0;
  }
  .row,
  .nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .nav {
    justify-content: space-between;
    margin-top: var(--space-4);
  }
  .progress p {
    margin: 0 0 var(--space-1);
  }
  .progress progress {
    width: 100%;
    height: 10px;
    accent-color: var(--accent);
  }
  .group {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  h2 small {
    color: var(--muted);
    font-size: var(--fs-sm);
    font-weight: 400;
  }
  .mini {
    height: 200px;
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    overflow: hidden;
  }
  .items {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--sheet);
    font-family: var(--font-num);
    cursor: pointer;
  }
  .item.checked {
    background: color-mix(in srgb, var(--reuse) 14%, var(--sheet));
    color: var(--muted);
  }
  .item input {
    flex: none;
    width: 28px;
    height: 28px;
    margin: 0;
    accent-color: var(--accent);
  }
</style>
