<script lang="ts">
  /**
   * Carte d'un mur maçonné : matériau de base, joint, zones (matériau, position, taille), élévation, quantités et
   * alertes. Dimensions modifiables pour un mur saisi ; lues dans le plan pour une cloison maçonnée.
   */
  import type { Snippet } from 'svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { BINDER_LABEL } from '../../core/defaults';
  import type { Material, Rect, SurfaceResult, WallResult } from '../../core/types';
  import type { WallBuild, WallZone } from '../../state/model';
  import { alertText } from '../lib/messages';
  import WallSketch from './WallSketch.svelte';

  let {
    title,
    head,
    length,
    height,
    holes,
    build,
    base,
    materials,
    result,
    onbase,
    onjoint,
    onzoneadd,
    onzone,
    onzoneremove,
  }: {
    title: string;
    /** Nom modifiable, lien vers le plan… */
    head: Snippet;
    length: number;
    height: number;
    holes: Rect[];
    build: WallBuild;
    /** Matériau de base retenu (choisi, ou celui de l'épaisseur de la cloison). */
    base: Material | undefined;
    materials: readonly Material[];
    result: WallResult | undefined;
    onbase: (id: string) => void;
    onjoint: (joint: number) => void;
    onzoneadd: () => void;
    onzone: (id: string, patch: Partial<Omit<WallZone, 'id'>>) => void;
    onzoneremove: (id: string) => void;
  } = $props();

  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  const materialOf = (id: string | null) => materials.find((m) => m.id === id);
  function options(id: string | null) {
    return [
      ...(id && !materialOf(id) ? [{ value: id, label: 'Matériau supprimé : en choisir un autre' }] : []),
      ...(!id
        ? [{ value: '', label: materials.length ? 'Choisir un matériau' : 'Aucun matériau dans la bibliothèque' }]
        : []),
      ...materials.map((m) => ({ value: m.id, label: m.name })),
    ];
  }
  const sketchZones = $derived(
    build.zones.map((z) => ({ ...z, glass: materialOf(z.material)?.laying.cutAllowed === false })),
  );
  const zoneResult = (id: string) => result?.zones.find((z) => z.id === id);
  const zoneAlerts = (id: string) => (result?.alerts ?? []).filter((a) => a.zone === id);
  const wallAlerts = $derived((result?.alerts ?? []).filter((a) => !a.zone));
  const figures = (r: SurfaceResult) =>
    [
      `${fr(r.area, 2)} m²`,
      `${r.elements} élément${r.elements > 1 ? 's' : ''}`,
      `${r.cut} coupé${r.cut > 1 ? 's' : ''}`,
      r.binderKg != null ? `${fr(r.binderKg)} kg de liant` : null,
      r.weightKg != null ? `${fr(r.weightKg)} kg` : null,
    ]
      .filter(Boolean)
      .join(' · ');
</script>

<li class="card">
  {@render head()}
  <WallSketch {length} {height} zones={sketchZones} {holes} label="Élévation de {title}" />
  <Select
    label="Matériau de base"
    value={build.material ?? base?.id ?? ''}
    options={options(build.material ?? base?.id ?? null)}
    onchange={(v) => v && onbase(v)}
  />
  {#if base}
    <NumberField
      label="Joint"
      unit="mm"
      min={0}
      max={50}
      value={build.joint ?? base.laying.jointH.def}
      hint="De {fr(base.laying.jointH.min)} à {fr(base.laying.jointH.max)} mm · {base.laying.bond === 'stack'
        ? 'joints alignés'
        : 'pose à demi-longueur'} · {BINDER_LABEL[base.laying.binder]}."
      onchange={onjoint}
    />
  {/if}
  {#if result?.ok}
    <p class="figures num">Base : {figures(result)}</p>
  {/if}

  {#each build.zones as z, i (z.id)}
    {@const zm = materialOf(z.material)}
    {@const zr = zoneResult(z.id)}
    <fieldset class="zone">
      <legend>Zone {i + 1}</legend>
      <div class="zhead">
        <Select
          label="Matériau de la zone"
          value={z.material ?? ''}
          options={options(z.material)}
          onchange={(v) => v && onzone(z.id, { material: v, joint: null })}
        />
        <IconButton icon="trash" label="Supprimer la zone {i + 1}" onclick={() => onzoneremove(z.id)} />
      </div>
      <div class="grid">
        <NumberField
          label="Depuis le début"
          unit="cm"
          factor={10}
          min={0}
          value={z.x}
          onchange={(x) => onzone(z.id, { x })}
        />
        <NumberField
          label="Depuis le sol"
          unit="cm"
          factor={10}
          min={0}
          value={z.y}
          onchange={(y) => onzone(z.id, { y })}
        />
        <NumberField
          label="Largeur"
          unit="cm"
          factor={10}
          min={1}
          value={z.width}
          onchange={(width) => onzone(z.id, { width })}
        />
        <NumberField
          label="Hauteur"
          unit="cm"
          factor={10}
          min={1}
          value={z.height}
          onchange={(h) => onzone(z.id, { height: h })}
        />
      </div>
      {#if zm && !zm.laying.cutAllowed}
        <p class="muted">Éléments entiers : la zone se règle sur un nombre entier de briques.</p>
      {/if}
      {#if zr?.ok}
        <p class="figures num">
          {figures(zr)}{zr.glass
            ? ` · ${zr.glass.cols} × ${zr.glass.rows} briques, bordures de ${fr(zr.glass.borderX / 10)} cm`
            : ''}
        </p>
      {/if}
      {#if zoneAlerts(z.id).length}
        <ul class="alerts">
          {#each zoneAlerts(z.id) as a, k (k)}<li>{alertText(a)}</li>{/each}
        </ul>
      {/if}
    </fieldset>
  {/each}
  <Button icon="plus" onclick={onzoneadd}>Ajouter une zone</Button>

  {#if wallAlerts.length}
    <ul class="alerts">
      {#each wallAlerts as a, i (i)}<li>{alertText(a)}</li>{/each}
    </ul>
  {/if}
</li>

<style>
  .card {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .zone {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
  }
  legend {
    font-weight: 600;
    padding: 0 var(--space-1);
  }
  .zhead {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--space-2);
  }
  /* une liste native garde la largeur de sa plus longue option : on la contraint à sa colonne */
  .zhead :global(select) {
    min-width: 0;
    width: 100%;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  .figures {
    margin: 0;
    font-weight: 600;
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .alerts {
    margin: 0;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--thin) 8%, var(--sheet));
  }
</style>
