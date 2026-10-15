<script lang="ts">
  /**
   * Calepinage d'une pose de parquet, dans la coquille commune (ui/calepinage) : plan des lames au centre ;
   * étapes Produit (lame), Pose (motif, angle, axe, optimisation, mode de pose), Découpage (pièces, seuils,
   * séparer en deux poses), Finitions (sous-couche, plinthes, barres de seuil), Avancé (règles).
   */
  import { onMount, untrack } from 'svelte';
  import type { Polygon } from '../../../../core/geometry/types';
  import type { Project } from '../../../../state/model';
  import PoseEditorShell from '../../../../ui/calepinage/PoseEditorShell.svelte';
  import type { StepId } from '../../../../ui/calepinage/steps';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { AxisKind, LayingMethod, Pattern, Threshold } from '../../core/types';
  import { shopping } from '../../state/module';
  import { ParquetEditorState } from '../editorState.svelte';
  import { errorText, warningText } from '../lib/messages';
  import ParquetPlan from './ParquetPlan.svelte';

  /** `poseId` : pose affichée à l'ouverture (#/p/:id/m/parquet/pose/:poseId). */
  let { project, poseId }: { project: Project; poseId?: string } = $props();

  const ed = untrack(() => new ParquetEditorState(project));
  $effect(() => {
    if (poseId) untrack(() => (ed.current = poseId));
  });
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

  /** Étape affichée, liste des poses (titre). */
  let step = $state<StepId>('product');
  let posesDialog = $state(false);
  /** « Pose 2 · Séjour, Bureau ». */
  const layoutTitle = (l: { name: string; rooms: string[] }) =>
    l.rooms.length ? `${l.name} · ${l.rooms.map(roomName).join(', ')}` : l.name;

  onMount(() => {
    const flush = () => void ed.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  });
</script>

{#snippet top()}
  {#if layout}
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
  {/if}
{/snippet}

{#snippet content(id: StepId)}
  {#if !ed.doc.plan.rooms.length}
    <EmptyState icon="room" title="Aucune pièce dans le plan" text="Dessinez d’abord les pièces à couvrir.">
      {#snippet action()}<Button variant="primary" href="#/p/{ed.doc.id}/plan">Dessiner les pièces</Button>{/snippet}
    </EmptyState>
  {:else if !layout}
    <EmptyState icon="room" title="Aucune pose de parquet" text="Revêtez un sol en parquet depuis l’écran de la pièce.">
      {#snippet action()}<Button variant="primary" href="#/p/{ed.doc.id}">Voir les pièces</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="step">
      {#if id === 'product'}
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
      {:else if id === 'pose'}
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
      {:else if id === 'cut'}
        <section aria-labelledby="pq-rooms">
          <h2 id="pq-rooms">Pièces de la pose</h2>
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
      {:else if id === 'finish'}
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
      {:else}
        <section aria-labelledby="pq-rules">
          <h2 id="pq-rules">Règles de pose</h2>
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
  {/if}
{/snippet}

{#snippet drawingArea()}
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
{/snippet}

<PoseEditorShell
  title={layout ? layoutTitle(layout) : 'Parquet'}
  failed={ed.failed}
  onretry={() => void ed.recompute()}
  context={ed.doc.name}
  ontitle={() => (posesDialog = true)}
  backHref={layout?.rooms[0] ? `#/p/${ed.doc.id}/r/${layout.rooms[0]}/sol` : `#/p/${ed.doc.id}`}
  canUndo={ed.canUndo}
  canRedo={ed.canRedo}
  onundo={() => ed.store.undo()}
  onredo={() => ed.store.redo()}
  resultsHref={layout ? `#/p/${ed.doc.id}/pose/${layout.id}/resultats` : `#/p/${ed.doc.id}/resultats`}
  {summary}
  panelLabel="Réglages du parquet"
  bind:step
  bind:snap
  bind:desktop
  peek={112}
  canvas={drawingArea}
  {top}
  {content}
/>

<Dialog bind:open={posesDialog} title="Poses de parquet">
  <div class="poses">
    {#each ed.layouts as l (l.id)}
      <button
        type="button"
        aria-current={l.id === layout?.id ? 'true' : undefined}
        onclick={() => ((ed.current = l.id), (ed.selected = null), (posesDialog = false))}
      >
        <strong>{l.name}</strong><span class="muted">{l.rooms.map(roomName).join(', ')}</span>
      </button>
    {/each}
    {#if layout}
      <TextField
        label="Nom de la pose"
        value={layout.name}
        onchange={(e) => {
          const name = e.currentTarget.value.trim();
          if (name && layout) ed.dispatch({ type: 'pose/rename', poseId: layout.id, name });
        }}
      />
    {/if}
    <p class="muted">Créer, étendre ou retirer une pose se fait sur l’écran de la pièce.</p>
  </div>
</Dialog>

<style>
  .step {
    display: grid;
    gap: var(--space-4);
  }
  .poses {
    display: grid;
    gap: var(--space-2);
  }
  .poses button {
    display: grid;
    justify-items: start;
    min-height: var(--touch);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .poses button[aria-current='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
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
    color: var(--color-error);
    font-weight: 600;
  }
</style>
