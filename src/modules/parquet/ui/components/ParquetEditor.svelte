<script lang="ts">
  /**
   * Éditeur du parquet : plan des lames au centre ; réglages dans le panneau (téléphone) ou à droite
   * (ordinateur) : pièces, lame, motif, angle, axe des motifs, règles ; résumé permanent vers les résultats.
   */
  import { onMount, untrack } from 'svelte';
  import type { Polygon } from '../../../../core/geometry/types';
  import type { Project } from '../../../../state/model';
  import BottomSheet from '../../../../ui/components/BottomSheet.svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { AxisKind, LayingMethod, Pattern } from '../../core/types';
  import { shopping } from '../../state/module';
  import { ParquetEditorState } from '../editorState.svelte';
  import { errorText, warningText } from '../lib/messages';
  import ParquetPlan from './ParquetPlan.svelte';

  let { project }: { project: Project } = $props();

  const ed = untrack(() => new ParquetEditorState(project));
  let desktop = $state(false);
  let snap = $state<0 | 1 | 2>(1);

  // projet modifié ailleurs (plan, autre onglet) : on reprend la version enregistrée la plus récente
  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => ed.doc);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) ed.store.reset(ext);
  });

  // calcul à chaque modification du projet ou de la bibliothèque de lames
  $effect(() => {
    void ed.doc;
    void app.libraries;
    void ed.recompute();
  });

  type Family = 'straight' | 'herringbone' | 'chevron';
  const FAMILIES: { value: Family; label: string; pattern: Pattern }[] = [
    { value: 'straight', label: 'Droite', pattern: { kind: 'random-stagger' } },
    { value: 'herringbone', label: 'Bâton rompu', pattern: { kind: 'herringbone' } },
    { value: 'chevron', label: 'Hongrie', pattern: { kind: 'chevron', endAngle: 45 } },
  ];
  const family = (p: Pattern): Family =>
    p.kind === 'herringbone' ? 'herringbone' : p.kind === 'chevron' ? 'chevron' : 'straight';
  const STAGGERS: { value: string; label: string; pattern: Pattern }[] = [
    { value: 'random', label: 'Coupe perdue', pattern: { kind: 'random-stagger' } },
    { value: '1/2', label: '½', pattern: { kind: 'regular-stagger', step: 1 / 2 } },
    { value: '1/3', label: '⅓', pattern: { kind: 'regular-stagger', step: 1 / 3 } },
    { value: '1/4', label: '¼', pattern: { kind: 'regular-stagger', step: 1 / 4 } },
  ];
  const staggerValue = (p: Pattern) =>
    p.kind === 'regular-stagger'
      ? (STAGGERS.find((x) => x.value === `1/${Math.round(1 / p.step)}`)?.value ?? 'random')
      : 'random';
  const AXES: Record<AxisKind, string> = {
    'room-center': 'Centre de la pièce',
    'main-door': 'Centre de la porte principale',
    'reference-wall': 'Aligné sur le mur de référence',
  };
  const METHODS: { value: LayingMethod; label: string }[] = [
    { value: 'floating', label: 'Flottante' },
    { value: 'glued', label: 'Collée' },
    { value: 'nailed', label: 'Clouée' },
  ];

  const layout = $derived(ed.layout);
  const result = $derived(ed.result?.layouts.find((l) => l.id === layout?.id) ?? null);
  const roomShapes = $derived<Polygon[]>(
    (layout?.rooms ?? []).flatMap((id) => {
      const r = ed.doc.plan.rooms.find((x) => x.id === id);
      return r ? [r.outline.map(([x, y]): [number, number] => [r.origin[0] + x, r.origin[1] + y])] : [];
    }),
  );
  const packs = $derived(
    ed.result ? shopping(ed.result, ed.data, app.libraries).reduce((t, l) => t + l.quantity, 0) : 0,
  );
  const summary = $derived(
    !ed.result || !result
      ? 'Calcul…'
      : result.errors.length
        ? 'Calcul impossible : voir les réglages'
        : `${ed.result.totals.boards} lames · ${packs} paquet${packs > 1 ? 's' : ''} · perte ${Math.round(ed.result.totals.wastePct)} %`,
  );
  const motif = $derived(layout ? family(layout.pattern) !== 'straight' : false);
  const piece = $derived(result?.pieces.find((p) => p.id === ed.selected));
  const CUT = { full: 'lame entière', straight: 'coupe droite', angled: 'coupe en biais', complex: 'découpe' };

  onMount(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const upd = () => (desktop = mq.matches);
    upd();
    mq.addEventListener('change', upd);
    const flush = () => void ed.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      mq.removeEventListener('change', upd);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  });
</script>

{#snippet panel()}
  <div class="panel">
    {#if !ed.doc.plan.rooms.length}
      <EmptyState icon="room" title="Aucune pièce dans le plan" text="Dessinez d’abord les pièces à couvrir.">
        {#snippet action()}<Button variant="primary" href="#/p/{ed.doc.id}/plan">Dessiner les pièces</Button>{/snippet}
      </EmptyState>
    {:else if !layout}
      <p>Aucune pose dans ce projet.</p>
      <Button variant="primary" icon="plus" onclick={() => ed.addLayout()}>Créer une pose</Button>
    {:else}
      {#if piece}
        <section class="info" aria-live="polite">
          <h2>Lame {piece.id}</h2>
          <p>
            {Math.round(piece.length).toLocaleString('fr-FR')} mm · {CUT[piece.cutType]}{piece.ripped
              ? ', recoupée en largeur'
              : ''}
            · {'offcut' in piece.source
              ? `taillée dans la chute ${piece.source.offcut}`
              : `lame neuve n° ${piece.source.board + 1}`}
          </p>
        </section>
      {/if}

      {#if result?.errors.length || result?.warnings.length}
        <section class="alerts" aria-label="Alertes">
          <ul>
            {#each result.errors as e, i (i)}<li class="err">{errorText(e)}</li>{/each}
            {#each [...new Set(result.warnings.map(warningText))] as w (w)}<li>{w}</li>{/each}
          </ul>
        </section>
      {/if}

      <section aria-labelledby="pq-rooms">
        <h2 id="pq-rooms">Pièces</h2>
        {#each ed.doc.plan.rooms as r (r.id)}
          <Checkbox label={r.name} checked={layout.rooms.includes(r.id)} onchange={(on) => ed.toggleRoom(r.id, on)} />
        {/each}
        <Button variant="ghost" href="#/p/{ed.doc.id}/plan">Modifier le plan</Button>
      </section>

      <section aria-labelledby="pq-board">
        <h2 id="pq-board">Lame</h2>
        {#if ed.boards.length}
          <Select
            label="Lame"
            value={layout.boardId}
            options={[
              ...(ed.board ? [] : [{ value: layout.boardId, label: 'Lame introuvable : choisissez-en une' }]),
              ...ed.boards.map((b) => ({ value: b.id, label: b.name })),
            ]}
            onchange={(id) => ed.chooseBoard(String(id))}
          />
        {:else}
          <p class="muted">La bibliothèque de lames est vide.</p>
        {/if}
        <Button variant="ghost" href="#/library/boards">Gérer les lames</Button>
      </section>

      <section aria-labelledby="pq-pose">
        <h2 id="pq-pose">Pose</h2>
        <Segmented
          label="Motif"
          value={family(layout.pattern)}
          options={FAMILIES.map(({ value, label }) => ({ value, label }))}
          onchange={(v) => {
            if (v !== family(layout.pattern))
              ed.updateLayout({ pattern: FAMILIES.find((f) => f.value === v)!.pattern });
          }}
        />
        {#if layout.pattern.kind === 'chevron'}
          <Segmented
            label="Coupe des bouts"
            value={layout.pattern.endAngle}
            options={[
              { value: 45, label: '45°' },
              { value: 60, label: '60°' },
            ]}
            onchange={(endAngle) => ed.updateLayout({ pattern: { kind: 'chevron', endAngle } })}
          />
        {:else if !motif}
          <Segmented
            label="Décalage des rangs"
            value={staggerValue(layout.pattern)}
            options={STAGGERS.map(({ value, label }) => ({ value, label }))}
            onchange={(v) => ed.updateLayout({ pattern: STAGGERS.find((p) => p.value === v)!.pattern })}
          />
        {/if}
        {#if motif && ed.board && !ed.board.handed}
          <p class="muted">
            Cette lame n’a pas de lames A et B. Un motif demande en général des lames gauches et droites.
          </p>
        {/if}
        <NumberField
          label={motif ? 'Angle du motif' : 'Angle des lames'}
          unit="°"
          min={0}
          max={179}
          decimals={0}
          value={layout.angle}
          hint={motif ? '0° : axe du motif parallèle au plus long mur.' : '0° : parallèles au plus long mur.'}
          onchange={(angle) => ed.updateLayout({ angle })}
        />
        {#if motif}
          <fieldset class="axes">
            <legend>Axe du motif</legend>
            {#each result?.axisOptions ?? [] as o (o.kind)}
              <label class="axis">
                <input
                  type="radio"
                  name="pq-axis"
                  value={o.kind}
                  checked={layout.axis === o.kind}
                  onchange={() => ed.updateLayout({ axis: o.kind })}
                />
                <span>
                  <strong>{AXES[o.kind]}</strong>
                  <small>plus petite coupe en bord : {o.minCutWidth.toLocaleString('fr-FR')} mm</small>
                </span>
              </label>
            {:else}
              <p class="muted">Calcul…</p>
            {/each}
          </fieldset>
        {:else}
          <Checkbox
            label="Rangs de bord de même largeur"
            checked={layout.rules.balanceEdgeRows === 'always'}
            onchange={(on) =>
              ed.updateLayout({ rules: { ...layout.rules, balanceEdgeRows: on ? 'always' : 'if-needed' } })}
          />
        {/if}
        <Select
          label="Mode de pose"
          value={layout.method}
          options={METHODS}
          onchange={(method) => ed.updateLayout({ method })}
        />
      </section>

      <section aria-labelledby="pq-rules">
        <h2 id="pq-rules">Règles</h2>
        <p class="muted">Valeurs du type de lame. Vérifier la notice du fabricant.</p>
        <div class="grid">
          <NumberField
            label="Jeu périphérique"
            unit="mm"
            min={0}
            decimals={0}
            value={layout.rules.expansionGap}
            onchange={(v) => ed.updateLayout({ rules: { ...layout.rules, expansionGap: v } })}
          />
          <NumberField
            label="Coupe mini en bout"
            unit="mm"
            min={0}
            decimals={0}
            value={layout.rules.minCutLength}
            onchange={(v) => ed.updateLayout({ rules: { ...layout.rules, minCutLength: v } })}
          />
          {#if !motif}
            <NumberField
              label="Décalage mini des joints"
              unit="mm"
              min={0}
              decimals={0}
              value={layout.rules.minJointOffset}
              onchange={(v) => ed.updateLayout({ rules: { ...layout.rules, minJointOffset: v } })}
            />
            <NumberField
              label="Rang de bord mini"
              unit="mm"
              min={0}
              decimals={0}
              value={layout.rules.minEdgeRowWidth}
              onchange={(v) => ed.updateLayout({ rules: { ...layout.rules, minEdgeRowWidth: v } })}
            />
          {/if}
        </div>
        <Button variant="ghost" onclick={() => ed.resetRules()} disabled={!ed.board}
          >Revenir aux valeurs du type de lame</Button
        >
      </section>
    {/if}
  </div>
{/snippet}

<div class="editor" class:desktop>
  <header class="bar">
    <IconButton icon="back" label="Projet" href="#/p/{ed.doc.id}" />
    <h1><span class="pname">{ed.doc.name}</span><span class="sub">Parquet</span></h1>
    <IconButton icon="undo" label="Annuler" disabled={!ed.canUndo} onclick={() => ed.store.undo()} />
    <IconButton icon="redo" label="Rétablir" disabled={!ed.canRedo} onclick={() => ed.store.redo()} />
    <IconButton icon="list" label="Résultats" href="#/p/{ed.doc.id}/m/parquet/results" />
  </header>
  <main class="body">
    <div class="planwrap" style={desktop ? '' : `bottom: ${snap === 0 ? '112px' : '50%'}`}>
      <ParquetPlan
        rooms={roomShapes}
        pieces={result?.pieces ?? []}
        color={ed.board?.color ?? '#c9a77c'}
        variants={motif}
        bind:selected={ed.selected}
        label="Plan des lames : {summary}"
      />
    </div>
    {#if desktop}
      <a class="summary bottom" href="#/p/{ed.doc.id}/m/parquet/results">{summary}</a>
      <aside class="inspector" aria-label="Réglages du parquet">{@render panel()}</aside>
    {:else}
      <BottomSheet label="Réglages du parquet" bind:snap contained peek={112}>
        {#snippet header()}<a class="summary" href="#/p/{ed.doc.id}/m/parquet/results">{summary}</a>{/snippet}
        {@render panel()}
      </BottomSheet>
    {/if}
  </main>
</div>

<style>
  .editor {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100dvh;
    background: var(--paper);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 56px;
    padding: env(safe-area-inset-top) 6px 0;
    border-bottom: 1px solid var(--line);
  }
  h1 {
    flex: 1;
    min-width: 0;
    display: grid;
    margin: 0 var(--space-2);
    font-size: var(--fs-md);
  }
  .pname {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: var(--fs-sm);
    font-weight: 400;
    color: var(--muted);
  }
  .body {
    position: relative;
    min-height: 0;
  }
  .planwrap {
    position: absolute;
    inset: 0;
  }
  .summary {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    font-family: var(--font-num);
    font-size: var(--fs-lg);
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
  }
  .summary::after {
    content: '›';
    margin-left: auto;
    color: var(--muted);
    font-size: var(--fs-xl);
  }
  .panel {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }
  section {
    display: grid;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-md);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .axes {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }
  .axes legend {
    margin-bottom: var(--space-2);
    padding: 0;
    font-weight: 600;
  }
  .axis {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--sheet);
    cursor: pointer;
  }
  .axis:has(input:checked) {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .axis input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: var(--accent);
  }
  .axis span {
    display: grid;
  }
  .axis small {
    color: var(--muted);
    font-family: var(--font-num);
  }
  .info p {
    margin: 0;
  }
  .alerts ul {
    margin: 0;
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
    border-left: 4px solid var(--cut);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--cut) 12%, var(--sheet));
  }
  .alerts .err {
    color: var(--thin);
    font-weight: 600;
  }
  .desktop .body {
    display: grid;
    grid-template-columns: 1fr 420px;
    grid-template-rows: 1fr auto;
  }
  .desktop .planwrap {
    position: relative;
    grid-column: 1;
    grid-row: 1;
  }
  .desktop .summary.bottom {
    grid-column: 1;
    grid-row: 2;
    padding: 0 var(--space-4);
    border-top: 1px solid var(--line);
  }
  .desktop .inspector {
    grid-column: 2;
    grid-row: 1 / span 2;
    overflow: auto;
    padding: var(--space-3) var(--space-4) var(--space-6);
    border-left: 1px solid var(--line);
    background: var(--sheet);
  }
</style>
