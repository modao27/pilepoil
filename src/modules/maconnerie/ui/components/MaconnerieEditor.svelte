<script lang="ts">
  /**
   * Murs et panneaux de maçonnerie du projet : une carte par mur (nom, matériau, dimensions, joint), avec ses rangs,
   * éléments, coupes, liant, poids et alertes ; réglages communs (marge, sac de liant).
   */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import ComputeFailed from '../../../../ui/components/ComputeFailed.svelte';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { BINDER_LABEL } from '../../core/defaults';
  import { summary } from '../../state/module';
  import { defaultSettings } from '../../state/model';
  import { MaconnerieEditorState } from '../editorState.svelte';
  import { alertText, NOTICE, SPEC_ERRORS } from '../lib/messages';

  let { project }: { project: Project } = $props();

  const ed = untrack(() => new MaconnerieEditorState(project));

  // projet modifié ailleurs (autre onglet) : on reprend la version enregistrée la plus récente
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

  const walls = $derived(ed.data?.walls ?? []);
  const settings = $derived(ed.data?.settings ?? defaultSettings());
  const materialOf = (id: string | null) => ed.materials.find((m) => m.id === id);
  const resultOf = (id: string) => ed.result?.walls.find((w) => w.id === id);
  const errors = $derived('errors' in ed.spec ? ed.spec.errors.filter((e) => e.code !== 'maconnerie/no-wall') : []);
  const text = $derived(
    !walls.length ? 'Aucun mur' : errors.length ? 'À compléter' : ed.result ? summary(ed.result).text : 'Calcul…',
  );
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  const options = $derived(
    ed.materials.length
      ? ed.materials.map((m) => ({ value: m.id, label: m.name }))
      : [{ value: '', label: 'Aucun matériau : en ajouter dans la bibliothèque' }],
  );
</script>

<Screen title="Maçonnerie" backHref="#/p/{project.id}" backLabel="Projet" wide>
  {#snippet actions()}
    <IconButton icon="undo" label="Annuler" disabled={!ed.canUndo} onclick={() => ed.store.undo()} />
    <IconButton icon="redo" label="Rétablir" disabled={!ed.canRedo} onclick={() => ed.store.redo()} />
  {/snippet}
  {#if ed.failed}<ComputeFailed onretry={() => void ed.recompute()} />{/if}
  <p class="summary num" aria-live="polite">{text}</p>
  <p class="muted">
    Saisissez chaque mur ou panneau par ses dimensions. Matériaux et techniques de pose :
    <a href="#/library/materials">bibliothèque</a>. {NOTICE}
  </p>
  {#if errors.length}
    <ul class="alerts" role="status">
      {#each errors as e, i (i)}<li>{SPEC_ERRORS[e.code]}</li>{/each}
    </ul>
  {/if}

  <ul class="walls">
    {#each walls as w (w.id)}
      {@const m = materialOf(w.material)}
      {@const r = resultOf(w.id)}
      <li class="card">
        <div class="head">
          <TextField
            label="Nom"
            value={w.name}
            maxlength={40}
            onchange={(e: Event) => {
              const v = (e.currentTarget as HTMLInputElement).value.trim();
              if (v) ed.update(w.id, { name: v });
            }}
          />
          <IconButton icon="trash" label="Supprimer {w.name}" onclick={() => ed.remove(w.id)} />
        </div>
        <Select
          label="Matériau"
          value={w.material ?? ''}
          options={[
            ...(w.material && !m ? [{ value: w.material, label: 'Matériau supprimé : en choisir un autre' }] : []),
            ...(!w.material && ed.materials.length ? [{ value: '', label: 'Choisir un matériau' }] : []),
            ...options,
          ]}
          onchange={(v) => v && ed.update(w.id, { material: v, joint: null })}
        />
        <div class="grid">
          <NumberField
            label="Longueur"
            unit="cm"
            factor={10}
            min={1}
            value={w.length}
            onchange={(length) => ed.update(w.id, { length })}
          />
          <NumberField
            label="Hauteur"
            unit="cm"
            factor={10}
            min={1}
            value={w.height}
            onchange={(height) => ed.update(w.id, { height })}
          />
          {#if m}
            <NumberField
              label="Joint"
              unit="mm"
              min={0}
              max={50}
              value={w.joint ?? m.laying.jointH.def}
              hint="De {fr(m.laying.jointH.min)} à {fr(m.laying.jointH.max)} mm pour ce matériau."
              onchange={(joint) => ed.update(w.id, { joint })}
            />
          {/if}
        </div>
        {#if m}
          <p class="muted">
            {m.laying.bond === 'stack' ? 'Joints alignés' : 'Pose à demi-longueur'} · {BINDER_LABEL[m.laying.binder]}{m
              .laying.cutAllowed
              ? ''
              : ' · éléments entiers, pas de coupe'}
          </p>
        {/if}
        {#if r?.ok}
          <dl class="figures num">
            <div>
              <dt>Surface</dt>
              <dd>{fr(r.area, 2)} m²</dd>
            </div>
            <div>
              <dt>Rangs</dt>
              <dd>{r.courses}</dd>
            </div>
            <div>
              <dt>Éléments</dt>
              <dd>{r.elements}</dd>
            </div>
            <div>
              <dt>Coupés</dt>
              <dd>{r.cut}</dd>
            </div>
            {#if r.binderKg != null}<div>
                <dt>Liant</dt>
                <dd>{fr(r.binderKg)} kg</dd>
              </div>{/if}
            {#if r.weightKg != null}<div>
                <dt>Poids</dt>
                <dd>{fr(r.weightKg)} kg</dd>
              </div>{/if}
          </dl>
          {#if r.glass}
            <p class="muted num">
              {r.glass.cols} × {r.glass.rows} briques · bordures de {fr(r.glass.borderX / 10)} cm (côtés) et {fr(
                r.glass.borderY / 10,
              )} cm (haut et bas) · {fr(r.glass.reinforcement / 1000)} m de fers
            </p>
          {/if}
        {/if}
        {#if r?.alerts.length}
          <ul class="alerts">
            {#each r.alerts as a, i (i)}<li>{alertText(a)}</li>{/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="row">
    <Button variant="primary" icon="plus" onclick={() => ed.addWall()}>Ajouter un mur</Button>
    {#if walls.length}<Button href="#/p/{project.id}/achats">Voir les achats</Button>{/if}
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
    margin: var(--space-4) 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
    gap: var(--space-3);
    align-items: start;
  }
  .card {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .head {
    display: grid;
    grid-template-columns: 1fr auto;
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
  .figures {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: var(--space-2);
    margin: 0;
  }
  dt {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
  dd {
    margin: 0;
    font-weight: 600;
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
  }
  .sub {
    margin: var(--space-5) 0 var(--space-3);
    font-size: var(--fs-md);
  }
</style>
