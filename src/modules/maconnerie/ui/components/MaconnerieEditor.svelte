<script lang="ts">
  /**
   * Murs de maçonnerie du projet : cloisons maçonnées du plan (dimensions et portes lues dans le plan) puis murs saisis
   * par leurs dimensions ; pour chacun, matériau de base, zones d'autres matériaux, élévation, quantités et alertes ;
   * réglages communs (marge, sac de liant).
   */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import ComputeFailed from '../../../../ui/components/ComputeFailed.svelte';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { partitionFrame } from '../../../../core/plan/works';
  import type { Target } from '../../state/actions';
  import { summary } from '../../state/module';
  import { defaultSettings } from '../../state/model';
  import { baseMaterial, masonryPartitions, partitionBuild, partitionHeight, partitionTitle } from '../../state/spec';
  import { MaconnerieEditorState } from '../editorState.svelte';
  import { NOTICE, SPEC_ERRORS } from '../lib/messages';
  import WallCard from './WallCard.svelte';

  let { project }: { project: Project } = $props();

  const ed = untrack(() => new MaconnerieEditorState(project));

  // projet modifié ailleurs (plan, autre onglet) : on reprend la version enregistrée la plus récente
  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => ed.doc);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) ed.store.reset(ext);
  });

  // calcul à chaque modification du projet ou de la bibliothèque
  $effect(() => {
    void ed.doc;
    void app.libraries;
    void ed.recompute();
  });

  onMount(() => {
    const flush = () => void ed.flush();
    window.addEventListener('pagehide', flush);
    const hide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hide);
      flush();
    };
  });

  const parts = $derived(masonryPartitions(ed.doc));
  const walls = $derived(ed.data?.walls ?? []);
  const settings = $derived(ed.data?.settings ?? defaultSettings());
  const resultOf = (id: string) => ed.result?.walls.find((w) => w.id === id);
  const errors = $derived('errors' in ed.spec ? ed.spec.errors.filter((e) => e.code !== 'maconnerie/no-wall') : []);
  const text = $derived(
    !parts.length && !walls.length
      ? 'Aucun mur'
      : errors.length
        ? 'À compléter'
        : ed.result
          ? summary(ed.result).text
          : 'Calcul…',
  );
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

  /** Fonctions de la carte d'un mur, pour une cible. */
  const handlers = (target: Target, length: number, height: number) => ({
    onbase: (id: string) => ed.setBase(target, id),
    onjoint: (joint: number) => ed.setJoint(target, joint),
    onzoneadd: () => ed.addZone(target, length, height),
    onzone: (id: string, patch: Parameters<typeof ed.updateZone>[2]) => ed.updateZone(target, id, patch),
    onzoneremove: (id: string) => ed.removeZone(target, id),
  });
</script>

<Screen title="Maçonnerie" backHref="#/p/{project.id}" backLabel="Projet" wide>
  {#snippet actions()}
    <IconButton icon="undo" label="Annuler" disabled={!ed.canUndo} onclick={() => ed.store.undo()} />
    <IconButton icon="redo" label="Rétablir" disabled={!ed.canRedo} onclick={() => ed.store.redo()} />
  {/snippet}
  {#if ed.failed}<ComputeFailed onretry={() => void ed.recompute()} />{/if}
  <p class="summary num" aria-live="polite">{text}</p>
  <p class="muted">
    Matériaux et techniques de pose : <a href="#/library/materials">bibliothèque</a>. {NOTICE}
  </p>
  {#if errors.length}
    <ul class="alerts" role="status">
      {#each errors as e, i (i)}<li>{SPEC_ERRORS[e.code]}</li>{/each}
    </ul>
  {/if}

  <h2 class="sub">Cloisons maçonnées du plan</h2>
  {#if parts.length}
    <ul class="walls">
      {#each parts as q (q.id)}
        {@const b = partitionBuild(ed.data, q.id)}
        {@const length = partitionFrame(q).length}
        {@const height = partitionHeight(ed.doc, q)}
        {@const title = partitionTitle(ed.doc, q.id)}
        <WallCard
          {title}
          {length}
          {height}
          holes={q.openings.map((o) => ({ x: o.offset, y: 0, width: o.width, height: o.height }))}
          build={b}
          base={baseMaterial(b, ed.materials, q.thickness)}
          materials={ed.materials}
          result={resultOf(q.id)}
          {...handlers({ partition: q.id }, length, height)}
        >
          {#snippet head()}
            <h3>{title}</h3>
            <p class="muted num">
              {fr(length / 10)} cm de long, {fr(height / 10)} cm de haut, {fr(q.thickness / 10)} cm d’épaisseur · lus dans
              le <a href="#/p/{project.id}/plan">plan</a>
            </p>
          {/snippet}
        </WallCard>
      {/each}
    </ul>
  {:else}
    <p class="muted">
      Dans le <a href="#/p/{project.id}/plan">plan</a>, calque Travaux, choisissez « Maçonnerie » pour une cloison :
      elle apparaît ici.
    </p>
  {/if}

  <h2 class="sub">Murs saisis</h2>
  <p class="muted">Pour un mur hors du plan (extérieur, bac, jardinière) : saisissez ses dimensions.</p>
  {#if walls.length}
    <ul class="walls">
      {#each walls as w (w.id)}
        <WallCard
          title={w.name}
          length={w.length}
          height={w.height}
          holes={[]}
          build={w}
          base={baseMaterial(w, ed.materials)}
          materials={ed.materials}
          result={resultOf(w.id)}
          {...handlers({ wall: w.id }, w.length, w.height)}
        >
          {#snippet head()}
            <div class="head">
              <TextField
                label="Nom"
                value={w.name}
                maxlength={40}
                onchange={(e: Event) => {
                  const v = (e.currentTarget as HTMLInputElement).value.trim();
                  if (v) ed.updateWall(w.id, { name: v });
                }}
              />
              <IconButton icon="trash" label="Supprimer {w.name}" onclick={() => ed.removeWall(w.id)} />
            </div>
            <div class="grid">
              <NumberField
                label="Longueur"
                unit="cm"
                factor={10}
                min={1}
                value={w.length}
                onchange={(length) => ed.updateWall(w.id, { length })}
              />
              <NumberField
                label="Hauteur"
                unit="cm"
                factor={10}
                min={1}
                value={w.height}
                onchange={(height) => ed.updateWall(w.id, { height })}
              />
            </div>
          {/snippet}
        </WallCard>
      {/each}
    </ul>
  {/if}

  <div class="row">
    <Button variant="primary" icon="plus" onclick={() => ed.addWall()}>Ajouter un mur</Button>
    {#if parts.length || walls.length}<Button href="#/p/{project.id}/achats">Voir les achats</Button>{/if}
  </div>

  {#if ed.data}
    <h2 class="sub">Réglages</h2>
    <div class="grid settings">
      <NumberField
        label="Marge de casse et de coupe"
        unit="%"
        factor={0.01}
        min={0}
        max={0.5}
        decimals={0}
        value={settings.margin}
        onchange={(margin) => ed.updateSettings({ margin })}
      />
      <NumberField
        label="Sac de liant"
        unit="kg"
        min={1}
        max={50}
        decimals={0}
        value={settings.binderBag}
        onchange={(binderBag) => ed.updateSettings({ binderBag })}
      />
    </div>
  {/if}
</Screen>

<style>
  a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }
  .summary {
    margin: 0 0 var(--space-2);
    font-size: var(--fs-lg);
    font-weight: 600;
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .walls {
    list-style: none;
    margin: var(--space-3) 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
    gap: var(--space-3);
    align-items: start;
  }
  h3 {
    margin: 0;
    font-size: var(--fs-md);
  }
  .head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--space-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  .settings {
    max-width: 640px;
  }
  .alerts {
    margin: 0;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--thin) 8%, var(--sheet));
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .sub {
    margin: var(--space-5) 0 var(--space-2);
    font-size: var(--fs-md);
  }
</style>
