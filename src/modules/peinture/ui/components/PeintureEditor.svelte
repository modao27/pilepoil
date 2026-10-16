<script lang="ts">
  /**
   * Réglages d'une pose de peinture, dans la coquille commune (ui/calepinage) : murs à plat au centre ;
   * étapes Produit (finition, apprêt, enduit), Pose (support, couches, ouvertures), Découpage (murs de la pose),
   * Finitions (boiseries, consommables), Avancé (marge, coefficients).
   */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../../../state/model';
  import PoseEditorShell from '../../../../ui/calepinage/PoseEditorShell.svelte';
  import type { StepId } from '../../../../ui/calepinage/steps';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { euros } from '../../../../ui/lib/format';
  import { SUPPORT_YIELD } from '../../core/defaults';
  import type { Paint } from '../../core/paint';
  import type { PaintRole, PaintUse, Support, SupportState } from '../../core/types';
  import { shopping } from '../../state/module';
  import { PeintureEditorState } from '../editorState.svelte';
  import { elevationOf } from '../lib/elevation';
  import { alertText, STATE_LABEL, SUPPORT_LABEL } from '../lib/messages';
  import WallsElevation from './WallsElevation.svelte';
  import TintPicker from './TintPicker.svelte';
  import { shownColor } from '../../core/colors';

  /** `poseId` : pose affichée à l'ouverture (#/p/:id/m/peinture/pose/:poseId). */
  let { project, poseId }: { project: Project; poseId?: string } = $props();

  const ed = untrack(() => new PeintureEditorState(project));
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

  // calcul à chaque modification du projet ou de la bibliothèque de peintures
  $effect(() => {
    void ed.doc;
    void app.libraries;
    void ed.recompute();
  });

  const layout = $derived(ed.layout);
  const s = $derived(layout?.settings);
  const result = $derived(ed.poseResult);
  const paintOf = (id: string | null) => ed.paints.find((p) => p.id === id);
  const finish = $derived(paintOf(s?.finish ?? null));
  const woodFinish = $derived(paintOf(s?.woodwork.finish ?? null));
  const elevation = $derived(layout ? elevationOf(ed.doc, layout.zones) : null);
  const areas = $derived(
    Object.fromEntries(
      (result?.zones ?? []).reduce((m, z) => {
        const k = z.room + '~' + z.wall;
        return m.set(k, (m.get(k) ?? 0) + z.net);
      }, new Map<string, number>()),
    ),
  );
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  const litres = $derived((result?.products ?? []).filter((p) => p.role === 'finish' && p.target === 'walls'));
  const cost = $derived(
    ed.result
      ? shopping(ed.result, ed.data, app.libraries).reduce((t, l) => t + (l.unitPrice ?? 0) * l.quantity, 0)
      : 0,
  );
  const summary = $derived(
    !result
      ? 'Calcul…'
      : !result.areas.net
        ? 'Rien à peindre : voir les murs'
        : `${fr(result.areas.net)} m² · ${fr(litres.reduce((t, p) => t + p.need, 0) / 1000)} L${cost ? ' · ' + euros(cost) : ''}`,
  );
  const roomName = (id: string) => ed.doc.plan.rooms.find((r) => r.id === id)?.name ?? 'pièce';
  const where = (l: { zones: { surface: { room: string } }[] }) =>
    [...new Set(l.zones.map((z) => roomName(z.surface.room)))].join(', ');

  /** Peintures proposées pour un rôle (et un usage) ; la peinture actuelle reste affichée si elle a disparu. */
  function options(role: PaintRole, use: PaintUse | null, current: string | null, none?: string) {
    const list = ed.paints
      .filter((p: Paint) => p.role === role && (!use || p.uses.includes(use)))
      .map((p) => ({ value: p.id, label: p.name }));
    const lost = current && !ed.paints.some((p) => p.id === current);
    return [
      ...(none ? [{ value: '', label: none }] : []),
      ...(lost ? [{ value: current, label: 'Peinture introuvable : choisissez-en une' }] : []),
      ...list,
    ];
  }
  const orNull = (v: string | number) => (v === '' ? null : String(v));

  const SUPPORTS = Object.entries(SUPPORT_LABEL) as [Support, string][];
  const STATES = Object.entries(STATE_LABEL) as [SupportState, string][];

  let step = $state<StepId>('product');
  let posesDialog = $state(false);
  const title = $derived(layout ? `${layout.name} · ${where(layout)}` : 'Peinture');
  const first = $derived(layout?.zones[0]?.surface);
  const backHref = $derived(first ? `#/p/${ed.doc.id}/r/${first.room}/${first.wall ?? 'sol'}` : `#/p/${ed.doc.id}`);

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
  {#if layout && result?.alerts.length}
    <section class="alerts" aria-label="Alertes">
      <ul>
        {#each result.alerts as a, i (i)}<li>{alertText(a)}</li>{/each}
      </ul>
    </section>
  {/if}
{/snippet}

{#snippet content(id: StepId)}
  {#if !ed.doc.plan.rooms.length}
    <EmptyState icon="room" title="Aucune pièce dans le plan" text="Dessinez d’abord les pièces à peindre.">
      {#snippet action()}<Button variant="primary" href="#/p/{ed.doc.id}/plan">Dessiner les pièces</Button>{/snippet}
    </EmptyState>
  {:else if !layout || !s}
    <EmptyState icon="room" title="Aucune pose de peinture" text="Peignez un mur depuis l’écran de la pièce.">
      {#snippet action()}<Button variant="primary" href="#/p/{ed.doc.id}">Voir les pièces</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="step">
      {#if id === 'product'}
        <section aria-labelledby="pe-finish">
          <h2 id="pe-finish">Peinture de finition</h2>
          {#if options('finish', 'walls', s.finish).length}
            <Select
              label="Peinture"
              value={s.finish ?? ''}
              options={[{ value: '', label: 'Choisir une peinture' }, ...options('finish', 'walls', s.finish)]}
              onchange={(v) => ed.update({ finish: orNull(v) })}
            />
          {:else}
            <p class="muted">La bibliothèque n’a pas de peinture de finition pour les murs.</p>
          {/if}
          {#if finish}
            <p class="muted">
              {finish.yield.toLocaleString('fr-FR')} m²/L par couche · {finish.coats} couches conseillées
            </p>
            <TintPicker
              label="Teinte des murs"
              value={s.color}
              productColor={finish.color}
              onchange={(color) => ed.update({ color })}
            />
          {/if}
          <NumberField
            label="Couches de finition"
            min={1}
            max={5}
            decimals={0}
            value={s.coats}
            onchange={(coats) => ed.update({ coats })}
          />
          <Button variant="ghost" href="#/library/paints">Gérer les peintures</Button>
        </section>
        <section aria-labelledby="pe-primer">
          <h2 id="pe-primer">Apprêt et enduit</h2>
          <Select
            label="Apprêt"
            value={s.primer ?? ''}
            options={options('primer', null, s.primer, 'Sans apprêt')}
            onchange={(v) => ed.update({ primer: orNull(v) })}
          />
          <Select
            label="Enduit de rebouchage"
            value={s.filler ?? ''}
            options={options('filler', null, s.filler, 'Sans enduit')}
            onchange={(v) => ed.update({ filler: orNull(v) })}
          />
          {#if s.filler}
            <Segmented
              label="État du support"
              value={s.fillerState}
              options={STATES.map(([value, label]) => ({ value, label }))}
              onchange={(fillerState) => ed.update({ fillerState })}
            />
          {/if}
        </section>
      {:else if id === 'pose'}
        <section aria-labelledby="pe-support">
          <h2 id="pe-support">Nature du mur</h2>
          <Select
            label="Support"
            value={s.support}
            options={SUPPORTS.map(([value, label]) => ({ value, label }))}
            onchange={(support) => ed.update({ support })}
          />
          <p class="muted">
            Le support change le rendement : ×{fr(SUPPORT_YIELD[s.support], 1)} sur {SUPPORT_LABEL[
              s.support
            ].toLowerCase()}.
          </p>
        </section>
        <section aria-labelledby="pe-openings">
          <h2 id="pe-openings">Portes et fenêtres</h2>
          <Segmented
            label="Surfaces déduites"
            value={s.openings.mode}
            options={[
              { value: 'threshold', label: 'Grandes' },
              { value: 'all', label: 'Toutes' },
              { value: 'none', label: 'Aucune' },
            ]}
            onchange={(mode) => ed.update({ openings: { ...s.openings, mode } })}
          />
          {#if s.openings.mode === 'threshold'}
            <NumberField
              label="Déduire au-delà de"
              unit="m²"
              factor={1_000_000}
              min={0}
              decimals={2}
              step={0.25}
              value={s.openings.threshold}
              onchange={(threshold) => ed.update({ openings: { ...s.openings, threshold } })}
            />
          {/if}
          <p class="muted">
            {fr(result?.areas.openings ?? 0, 2)} m² déduits sur {fr(result?.areas.gross ?? 0, 2)} m² de murs{result
              ?.areas.skirting
              ? `, et ${fr(result.areas.skirting, 2)} m² cachés par les plinthes`
              : ''}.
          </p>
        </section>
      {:else if id === 'cut'}
        <section aria-labelledby="pe-walls">
          <h2 id="pe-walls">Murs de la pose</h2>
          <ul class="walls">
            {#each elevation?.walls ?? [] as w (w.room + w.wall)}
              <li>
                <strong>{w.label}</strong>
                <span class="muted">{fr(areas[w.room + '~' + w.wall] ?? 0)} m² à peindre</span>
              </li>
            {/each}
          </ul>
          <p class="muted">
            Ajouter un mur, peindre une partie seulement ou en retirer un se fait sur l’écran de la pièce.
          </p>
          <Button href={backHref}>Ouvrir la pièce</Button>
        </section>
      {:else if id === 'finish'}
        <section aria-labelledby="pe-wood">
          <h2 id="pe-wood">Boiseries</h2>
          <Checkbox
            label="Plinthes"
            checked={s.woodwork.skirting}
            onchange={(skirting) => ed.updateWoodwork({ skirting })}
          />
          {#if s.woodwork.skirting}
            <NumberField
              label="Hauteur des plinthes"
              unit="cm"
              factor={10}
              min={1}
              decimals={1}
              value={s.woodwork.skirtingHeight}
              onchange={(skirtingHeight) => ed.updateWoodwork({ skirtingHeight })}
            />
          {/if}
          <Checkbox
            label="Huisseries des portes et fenêtres"
            checked={s.woodwork.frames}
            onchange={(frames) => ed.updateWoodwork({ frames })}
          />
          {#if s.woodwork.frames}
            <NumberField
              label="Largeur des chambranles"
              unit="cm"
              factor={10}
              min={1}
              decimals={1}
              value={s.woodwork.frameWidth}
              onchange={(frameWidth) => ed.updateWoodwork({ frameWidth })}
            />
          {/if}
          <Checkbox label="Portes" checked={s.woodwork.doors} onchange={(doors) => ed.updateWoodwork({ doors })} />
          {#if s.woodwork.doors}
            <Segmented
              label="Faces peintes"
              value={s.woodwork.doorFaces}
              options={[
                { value: 1, label: 'Une' },
                { value: 2, label: 'Deux' },
              ]}
              onchange={(doorFaces) => ed.updateWoodwork({ doorFaces })}
            />
          {/if}
          {#if s.woodwork.skirting || s.woodwork.frames || s.woodwork.doors}
            <Select
              label="Peinture des boiseries"
              value={s.woodwork.finish ?? ''}
              options={[
                { value: '', label: 'Choisir une peinture' },
                ...options('finish', 'woodwork', s.woodwork.finish),
              ]}
              onchange={(v) => ed.updateWoodwork({ finish: orNull(v) })}
            />
            {#if woodFinish}
              <TintPicker
                label="Teinte des boiseries"
                value={s.woodwork.color}
                productColor={woodFinish.color}
                onchange={(color) => ed.updateWoodwork({ color })}
              />
            {/if}
            <NumberField
              label="Couches"
              min={1}
              max={5}
              decimals={0}
              value={s.woodwork.coats}
              onchange={(coats) => ed.updateWoodwork({ coats })}
            />
            <Select
              label="Apprêt des boiseries"
              value={s.woodwork.primer ?? ''}
              options={options('primer', null, s.woodwork.primer, 'Sans apprêt')}
              onchange={(v) => ed.updateWoodwork({ primer: orNull(v) })}
            />
            <p class="muted">{fr(result?.woodwork.total ?? 0, 2)} m² de boiseries.</p>
          {/if}
        </section>
        <section aria-labelledby="pe-supplies">
          <h2 id="pe-supplies">Fournitures</h2>
          <Checkbox
            label="Ruban de masquage"
            checked={s.consumables.masking}
            onchange={(masking) => ed.update({ consumables: { ...s.consumables, masking } })}
          />
          <Checkbox
            label="Bâche de protection"
            checked={s.consumables.sheet}
            onchange={(sheet) => ed.update({ consumables: { ...s.consumables, sheet } })}
          />
          <Checkbox
            label="Rouleau et bac"
            checked={s.consumables.roller}
            onchange={(roller) => ed.update({ consumables: { ...s.consumables, roller } })}
          />
          <Checkbox
            label="Brosse à rechampir"
            checked={s.consumables.brush}
            onchange={(brush) => ed.update({ consumables: { ...s.consumables, brush } })}
          />
        </section>
      {:else}
        <section aria-labelledby="pe-adv">
          <h2 id="pe-adv">Marge</h2>
          <NumberField
            label="Perte de chantier"
            unit="%"
            min={0}
            max={50}
            decimals={0}
            value={Math.round(s.margin * 100)}
            hint="Ajoutée aux litres : pots mal vidés, reprises."
            onchange={(v) => ed.update({ margin: v / 100 })}
          />
        </section>
        <section aria-labelledby="pe-detail">
          <h2 id="pe-detail">Détail du calcul</h2>
          <ul class="walls">
            {#each result?.products ?? [] as p (p.key)}
              <li>
                <strong>{paintOf(p.paint)?.name ?? 'Peinture'}</strong>
                <span class="muted">
                  {fr(p.need / 1000)}
                  {p.role === 'filler' ? 'kg' : 'L'} sur {fr(p.surface)} m² ·
                  {p.packs.map((k) => `${k.count} × ${fr(k.size, 2)}`).join(' + ') || 'pas de pot'}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet drawingArea()}
  {#if elevation?.walls.length}
    <WallsElevation {elevation} color={shownColor(s?.color, finish?.color)} {areas} />
  {:else}
    <EmptyState icon="room" title="Aucun mur" text="Peignez un mur depuis l’écran de la pièce." />
  {/if}
{/snippet}

<PoseEditorShell
  {title}
  failed={ed.failed}
  onretry={() => void ed.recompute()}
  context={ed.doc.name}
  ontitle={() => (posesDialog = true)}
  {backHref}
  canUndo={ed.canUndo}
  canRedo={ed.canRedo}
  onundo={() => ed.store.undo()}
  onredo={() => ed.store.redo()}
  resultsHref={layout ? `#/p/${ed.doc.id}/pose/${layout.id}/resultats` : `#/p/${ed.doc.id}/resultats`}
  {summary}
  panelLabel="Réglages de la peinture"
  bind:step
  bind:snap
  bind:desktop
  peek={112}
  canvas={drawingArea}
  {top}
  {content}
/>

<Dialog bind:open={posesDialog} title="Poses de peinture">
  <div class="poses">
    {#each ed.layouts as l (l.id)}
      <button
        type="button"
        aria-current={l.id === layout?.id ? 'true' : undefined}
        onclick={() => ((ed.current = l.id), (posesDialog = false))}
      >
        <strong>{l.name}</strong><span class="muted">{where(l)}</span>
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
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .walls {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .walls li {
    display: grid;
    gap: 2px;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--sheet);
  }
  .alerts ul {
    margin: 0;
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
    border-left: 4px solid var(--cut);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--cut) 12%, var(--sheet));
  }
</style>
