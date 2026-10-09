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
  import type { AxisKind, LayingMethod, Pattern, Threshold } from '../../core/types';
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
  // pièces de toutes les poses ; les lames des autres poses sont atténuées
  const roomShapes = $derived<Polygon[]>(
    [...new Set(ed.layouts.flatMap((l) => l.rooms))].flatMap((id) => {
      const r = ed.doc.plan.rooms.find((x) => x.id === id);
      return r ? [r.outline.map(([x, y]): [number, number] => [r.origin[0] + x, r.origin[1] + y])] : [];
    }),
  );
  const packs = $derived(
    ed.result
      ? shopping(ed.result, ed.data, app.libraries).reduce((t, l) => t + (l.unit === 'pack' ? l.quantity : 0), 0)
      : 0,
  );
  const summary = $derived(
    !ed.result || !result
      ? 'Calcul…'
      : result.errors.length
        ? 'Calcul impossible : voir les réglages'
        : `${ed.result.totals.boards} lames · ${packs} paquet${packs > 1 ? 's' : ''} · perte ${Math.round(ed.result.totals.wastePct)} %`,
  );
  const others = $derived(
    (ed.result?.layouts ?? [])
      .filter((r) => r.id !== layout?.id)
      .map((r) => {
        const l = ed.layouts.find((x) => x.id === r.id);
        return { pieces: r.pieces, color: ed.boards.find((b) => b.id === l?.boardId)?.color ?? '#c9a77c' };
      }),
  );
  const roomName = (id: string) => ed.doc.plan.rooms.find((r) => r.id === id)?.name ?? 'pièce';
  /** Autres poses sur le sol d'une pièce (parquet ou autre revêtement) : « Pose 2 », pour la case de la pièce. */
  function coveredBy(roomId: string): string {
    const ids = new Set(
      ed.doc.zones
        .filter((z) => z.surface.room === roomId && z.surface.wall == null && z.pose !== layout?.id)
        .map((z) => z.pose),
    );
    return ed.doc.poses
      .filter((p) => ids.has(p.id))
      .map((p) => p.name)
      .join(', ');
  }
  /** Seuil dans un passage : « entre Séjour et Bureau ». */
  function where(t: Threshold): string {
    const p = t.passage ? ed.doc.plan.passages.find((x) => x.id === t.passage) : undefined;
    return p ? ` entre ${roomName(p.a.room)} et ${roomName(p.b.room)}` : '';
  }
  function thresholdTitle(t: Threshold): string {
    if (t.status === 'applied') return `Seuil posé${where(t)}`;
    return t.reason === 'narrow-passage'
      ? `Seuil conseillé${where(t)} : passage étroit`
      : `Seuil conseillé${where(t)} : surface trop grande`;
  }
  /** Seuils posés de la pose (breaks) : index pour « Retirer » ; les limites de zone n'en ont pas. */
  const breakIndex = (t: Threshold) => t.breakIndex ?? -1;
  /** Cases des pièces refusées (sol déjà couvert…) : compteur pour les redessiner. */
  let refused = $state(0);
  /** Tracé d'un seuil à la main : deux points sur le plan. */
  let drawing = $state(false);
  const acc = $derived(ed.data.accessories);
  /* glisser la pose sur le plan : décalage aimanté au quart de la largeur de lame, un geste = une étape */
  let dragFrom: [number, number] | null = null;
  let gesture = 0;
  const snapStep = $derived((ed.board?.width ?? 100) / 4);
  function drag(delta: [number, number], phase: 'move' | 'end') {
    const l = layout;
    if (!l) return;
    if (!dragFrom) {
      dragFrom = l.offset;
      gesture++;
    }
    const snap = (v: number) => Math.round(v / snapStep) * snapStep;
    const offset: [number, number] = [
      Math.round((dragFrom[0] + snap(delta[0])) * 10) / 10,
      Math.round((dragFrom[1] + snap(delta[1])) * 10) / 10,
    ];
    ed.updateLayout({ offset }, `parquet-drag-${gesture}`);
    if (phase === 'end') dragFrom = null;
  }
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

      <section aria-labelledby="pq-layouts" class="layouts">
        <h2 id="pq-layouts" class="visually-hidden">Poses</h2>
        {#if ed.layouts.length > 1}
          <Select
            label="Pose affichée"
            value={layout.id}
            options={ed.layouts.map((l) => ({ value: l.id, label: l.name }))}
            onchange={(id) => ((ed.current = String(id)), (ed.selected = null))}
          />
        {/if}
        <div class="row">
          <Button variant="ghost" icon="plus" onclick={() => ed.addLayout()}>Nouvelle pose</Button>
          <Button variant="ghost" icon="trash" onclick={() => ed.removeLayout()}>Supprimer cette pose</Button>
        </div>
      </section>

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
        <!-- refus : cases redessinées dans leur état réel -->
        {#key refused}
          {#each ed.doc.plan.rooms as r (r.id)}
            <Checkbox
              label={coveredBy(r.id) ? `${r.name} (${coveredBy(r.id)})` : r.name}
              checked={layout.rooms.includes(r.id)}
              onchange={(on) => ed.toggleRoom(r.id, on) || refused++}
            />
          {/each}
        {/key}
        <Button variant="ghost" href="#/p/{ed.doc.id}/plan">Modifier le plan</Button>
        <h3>Seuils</h3>
        {#if drawing}
          <p class="muted" role="status">
            Touchez le plan à deux endroits, de part et d’autre de la zone à séparer. Le seuil est prolongé jusqu’aux
            murs.
          </p>
          <Button variant="secondary" onclick={() => (drawing = false)}>Annuler le tracé</Button>
        {:else}
          <Button variant="ghost" icon="edit" onclick={() => ((drawing = true), (ed.selected = null))}
            >Tracer un seuil</Button
          >
        {/if}
        {#if result?.thresholds.length}
          <ul class="thresholds">
            {#each result.thresholds as t, i (i)}
              <li class:proposed={t.status === 'proposed'}>
                <span>{thresholdTitle(t)}</span>
                <div class="row">
                  {#if t.status === 'proposed'}
                    <Button variant="secondary" onclick={() => ed.addBreak(t.segment)}>Poser ce seuil</Button>
                    <Button variant="ghost" onclick={() => ed.split(t.segment)}>Séparer en deux poses</Button>
                  {:else if breakIndex(t) >= 0}
                    <Button variant="ghost" onclick={() => ed.split(t.segment)}>Séparer en deux poses</Button>
                    <Button variant="ghost" onclick={() => ed.removeBreak(breakIndex(t))}>Retirer</Button>
                  {:else}
                    <small class="muted">Limite avec une autre pose.</small>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
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
        {#if ed.optimizing != null}
          <div class="optim" role="status">
            <label for="pq-optim">Recherche du meilleur départ…</label>
            <progress id="pq-optim" max="100" value={ed.optimizing}>{ed.optimizing} %</progress>
            <Button variant="secondary" onclick={() => ed.stopOptimize()}>Arrêter</Button>
          </div>
        {:else}
          <Button
            variant="secondary"
            icon="sparkle"
            disabled={!result || !!result.errors.length}
            onclick={() => void ed.optimize()}>Optimiser le départ</Button
          >
        {/if}
        <Select
          label="Mode de pose"
          value={layout.method}
          options={METHODS}
          onchange={(method) => ed.updateLayout({ method })}
        />
      </section>

      <section aria-labelledby="pq-finish">
        <h2 id="pq-finish">Finitions</h2>
        <Checkbox
          label="Sous-couche"
          hint="Pose flottante seulement."
          checked={acc.underlay.enabled}
          onchange={(enabled) => ed.updateAccessories({ underlay: { ...acc.underlay, enabled } })}
        />
        {#if acc.underlay.enabled}
          <NumberField
            label="Rouleau de sous-couche"
            unit="m²"
            min={1}
            decimals={1}
            value={acc.underlay.m2PerRoll}
            onchange={(m2PerRoll) => ed.updateAccessories({ underlay: { ...acc.underlay, m2PerRoll } })}
          />
        {/if}
        <Checkbox
          label="Pare-vapeur"
          hint="Sur dalle béton ou chape : recouvrement et remontée en bord de mur."
          checked={acc.vaporBarrier.enabled}
          onchange={(enabled) => ed.updateAccessories({ vaporBarrier: { ...acc.vaporBarrier, enabled } })}
        />
        {#if acc.vaporBarrier.enabled}
          <NumberField
            label="Rouleau de pare-vapeur"
            unit="m²"
            min={1}
            decimals={1}
            value={acc.vaporBarrier.m2PerRoll}
            onchange={(m2PerRoll) => ed.updateAccessories({ vaporBarrier: { ...acc.vaporBarrier, m2PerRoll } })}
          />
        {/if}
        <Checkbox
          label="Plinthes"
          checked={acc.skirting.enabled}
          onchange={(enabled) => ed.updateAccessories({ skirting: { ...acc.skirting, enabled } })}
        />
        {#if acc.skirting.enabled}
          <div class="grid">
            <NumberField
              label="Barre de plinthe"
              unit="mm"
              min={100}
              decimals={0}
              value={acc.skirting.barLength}
              onchange={(barLength) => ed.updateAccessories({ skirting: { ...acc.skirting, barLength } })}
            />
            <NumberField
              label="Supplément par onglet"
              unit="mm"
              min={0}
              decimals={0}
              value={acc.skirting.mitreAllowance}
              onchange={(mitreAllowance) => ed.updateAccessories({ skirting: { ...acc.skirting, mitreAllowance } })}
            />
          </div>
          <Checkbox
            label="Plinthes autour des obstacles"
            checked={acc.skirting.aroundObstacles}
            onchange={(aroundObstacles) => ed.updateAccessories({ skirting: { ...acc.skirting, aroundObstacles } })}
          />
        {/if}
        <NumberField
          label="Barre de seuil"
          unit="mm"
          min={100}
          decimals={0}
          value={acc.thresholds.barLength}
          hint="Une barre par seuil posé, coupée à la largeur du passage."
          onchange={(barLength) => ed.updateAccessories({ thresholds: { barLength } })}
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
    <IconButton icon="check" label="Chantier" href="#/p/{ed.doc.id}/m/parquet/chantier" />
    <IconButton icon="list" label="Résultats" href="#/p/{ed.doc.id}/m/parquet/results" />
  </header>
  <main class="body">
    <div class="planwrap" style={desktop ? '' : `bottom: ${snap === 0 ? '112px' : '50%'}`}>
      <ParquetPlan
        rooms={roomShapes}
        pieces={result?.pieces ?? []}
        color={ed.board?.color ?? '#c9a77c'}
        variants={motif}
        {others}
        thresholds={result?.thresholds ?? []}
        ondrag={layout && !drawing ? drag : undefined}
        {drawing}
        ondraw={(s) => {
          ed.addBreak(s);
          drawing = false;
        }}
        keyStep={snapStep}
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
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  h3 {
    margin: 0;
    font-size: var(--fs-base);
  }
  .thresholds {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .thresholds li {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    background: var(--sheet);
  }
  .thresholds li.proposed {
    border-left-style: dashed;
  }
  .optim {
    display: grid;
    gap: var(--space-2);
  }
  .optim progress {
    width: 100%;
    height: 8px;
    accent-color: var(--accent);
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
