<script lang="ts">
  /**
   * Cloisons du projet : une carte par cloison du plan (système, hauteur, entraxe, plaque par face, isolant, renforts),
   * alertes du calcul, résumé. Les cloisons se dessinent dans le plan (calque Travaux).
   */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { InsulationKind, PlateType } from '../../core/types';
  import { summary } from '../../state/module';
  import { systemFor } from '../../state/spec';
  import { CloisonsEditorState } from '../editorState.svelte';
  import { alertText } from '../lib/messages';
  import CloisonsSettingsForm from './CloisonsSettingsForm.svelte';

  let { project }: { project: Project } = $props();

  const ed = untrack(() => new CloisonsEditorState(project));

  // projet modifié ailleurs (plan, autre onglet) : on reprend la version enregistrée la plus récente
  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => ed.doc);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) ed.store.reset(ext);
  });

  // calcul à chaque modification du projet ou de la bibliothèque de systèmes
  $effect(() => {
    void ed.doc;
    void app.libraries;
    void ed.recompute();
  });

  onMount(() => {
    const flush = () => void ed.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  });

  const PLATES: { value: PlateType; label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'hydro', label: 'Hydrofuge' },
    { value: 'phonic', label: 'Phonique' },
    { value: 'fire', label: 'Coupe-feu' },
  ];
  const INSULATIONS: { value: InsulationKind | 'none'; label: string }[] = [
    { value: 'none', label: 'Sans isolant' },
    { value: 'glass-wool', label: 'Laine de verre' },
    { value: 'rock-wool', label: 'Laine de roche' },
    { value: 'wood-fibre', label: 'Fibre de bois' },
  ];

  const parts = $derived('spec' in ed.spec ? ed.spec.spec.partitions : []);
  const resultOf = (id: string) => ed.result?.partitions.find((p) => p.id === id);
  const text = $derived(ed.result ? summary(ed.result).text : 'Calcul…');
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
</script>

<Screen title="Cloisons" backHref="#/p/{project.id}" backLabel="Projet" wide>
  {#snippet actions()}
    <IconButton icon="undo" label="Annuler" disabled={!ed.canUndo} onclick={() => ed.store.undo()} />
    <IconButton icon="redo" label="Rétablir" disabled={!ed.canRedo} onclick={() => ed.store.redo()} />
  {/snippet}
  <p class="summary num" aria-live="polite">{text}</p>
  <p class="muted">
    Les cloisons se dessinent dans le <a href="#/p/{project.id}/plan">plan</a>, calque Travaux. Vérifier la notice du
    fabricant pour les hauteurs, entraxes et fixations.
  </p>
  <ul class="parts">
    {#each parts as p (p.id)}
      {@const s = ed.settingsOf(p.id)}
      {@const sys = systemFor(ed.data.partitions[p.id], { thickness: 0 }, ed.systems)}
      {@const res = resultOf(p.id)}
      <li class="card">
        <h2>{p.name}</h2>
        <p class="muted num">{fr(p.length / 10)} cm de long, {fr(p.height / 10)} cm de haut</p>
        <Select
          label="Système"
          value={p.system}
          options={ed.systems.length
            ? ed.systems.map((x) => ({ value: x.id, label: x.name }))
            : [{ value: '', label: 'Aucun système : en ajouter dans la bibliothèque' }]}
          onchange={(v) => v && ed.setSystem(p.id, v)}
        />
        <Checkbox
          label="Hauteur des pièces voisines"
          checked={s.height == null}
          onchange={(c) => ed.update(p.id, { height: c ? null : p.height })}
        />
        {#if s.height != null}
          <NumberField
            label="Hauteur de la cloison"
            unit="cm"
            factor={10}
            min={10}
            value={s.height}
            onchange={(height) => ed.update(p.id, { height }, `h:${p.id}`)}
          />
        {/if}
        <Segmented
          label="Entraxe des montants"
          value={s.spacing}
          options={[
            { value: 600, label: '60 cm' },
            { value: 400, label: '40 cm' },
          ]}
          onchange={(spacing) => ed.update(p.id, { spacing })}
        />
        <div class="grid">
          <Select
            label="Plaque, face A"
            value={s.plates.a}
            options={PLATES}
            onchange={(a) => ed.update(p.id, { plates: { ...s.plates, a } })}
          />
          <Select
            label="Plaque, face B"
            value={s.plates.b}
            options={PLATES}
            onchange={(b) => ed.update(p.id, { plates: { ...s.plates, b } })}
          />
        </div>
        <p class="muted">Face A : à gauche dans le sens du tracé de la cloison ; face B : à droite.</p>
        <Select
          label="Isolant"
          value={s.insulation?.kind ?? 'none'}
          options={INSULATIONS}
          onchange={(k) => ed.update(p.id, { insulation: k === 'none' ? null : { kind: k } })}
        />
        <Checkbox
          label="Montants de départ et de liaison doublés"
          checked={s.reinforcement.ends === 'double'}
          onchange={(c) =>
            ed.update(p.id, {
              reinforcement: {
                ...s.reinforcement,
                ends: c ? 'double' : 'single',
                junctions: c ? 'double' : 'single',
              },
            })}
        />
        <Checkbox
          label="Renfort bois dans les montants de porte"
          checked={s.reinforcement.woodInsert}
          onchange={(c) => ed.update(p.id, { reinforcement: { ...s.reinforcement, woodInsert: c } })}
        />
        {#if sys}<p class="muted">Système choisi : {sys.name}, {fr(sys.thickness)} mm finis.</p>{/if}
        {#if res?.alerts.length}
          <ul class="alerts" aria-label="Alertes de {p.name}">
            {#each res.alerts as a, i (a.code + i)}<li>{alertText(a)}</li>{/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
  {#if ed.result?.alerts.length === 0 && parts.length}
    <p class="muted">Aucune alerte.</p>
  {/if}
  <CloisonsSettingsForm {ed} />
  <div class="row">
    <Button variant="primary" href="#/p/{project.id}/achats">Liste d’achat</Button>
  </div>
</Screen>

<style>
  .summary {
    margin: 0 0 var(--space-2);
    font-size: var(--fs-lg);
    font-weight: 600;
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .parts {
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
  h2 {
    margin: 0;
    font-size: var(--fs-md);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
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
    gap: var(--space-2);
  }
</style>
