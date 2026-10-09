<script lang="ts">
  import type { Edges } from '../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { cm } from '../../../../ui/lib/format';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const s = $derived(ed.surface);
  const pl = $derived(s.plinth);
  const plinthPieces = $derived(ed.build?.pieces.map((p, i) => [p, i] as const).filter(([p]) => p.plinth) ?? []);
  const plinthReused = $derived(plinthPieces.filter(([, i]) => ed.result?.plan.reused[ed.offset + i]).length);
  const settings = $derived(ed.project.settings);
  /** Pourtour du sol (contour de la pièce, sans les obstacles). */
  const perimeter = $derived.by(() => {
    const r = s.outline?.[0];
    if (!r) return 2 * (s.width + s.height);
    return r.reduce((t, p, i) => {
      const q = r[(i + 1) % r.length]!;
      return t + Math.hypot(q[0] - p[0], q[1] - p[1]);
    }, 0);
  });

  const setEdge = (k: keyof Edges, v: boolean) => ed.updateSurface({ hiddenEdges: { ...s.hiddenEdges, [k]: v } });
  const setPlinth = (p: Partial<NonNullable<typeof pl>>) =>
    ed.updateSurface({ plinth: { length: 0, height: 80, bandId: s.bands[0]!.id, ...(pl ?? {}), ...p } });
</script>

<div class="tab">
  <section aria-labelledby="f-edges">
    <h3 id="f-edges">Bords cachés</h3>
    <p class="muted">
      Cochez les bords masqués par une plinthe, un angle ou un meuble : les coupes y vont en priorité.
    </p>
    {#if s.kind === 'floor'}
      <Checkbox
        label="Bords le long des murs"
        checked={s.outlineHidden}
        onchange={(v) => ed.updateSurface({ edgesHidden: v })}
      />
    {:else}
      <div class="two">
        <Checkbox label="Haut" checked={s.hiddenEdges.top} onchange={(v) => setEdge('top', v)} />
        <Checkbox label="Bas" checked={s.hiddenEdges.bottom} onchange={(v) => setEdge('bottom', v)} />
        <Checkbox label="Gauche" checked={s.hiddenEdges.left} onchange={(v) => setEdge('left', v)} />
        <Checkbox label="Droite" checked={s.hiddenEdges.right} onchange={(v) => setEdge('right', v)} />
      </div>
    {/if}
    {#if s.bands.length > 1}
      <Checkbox
        label="Jonctions entre bandes recouvertes"
        hint="Listel ou profilé entre les bandes."
        checked={s.junctionsCovered}
        onchange={(v) => ed.updateSurface({ junctionsCovered: v })}
      />
    {/if}
  </section>

  {#if s.kind === 'floor'}
    <section aria-labelledby="f-plinth">
      <h3 id="f-plinth">Plinthes en carrelage</h3>
      <div class="row">
        <Button onclick={() => setPlinth({ length: Math.round(perimeter) })}>Périmètre</Button>
        <Button onclick={() => setPlinth({ length: s.width })}>Longueur de la surface</Button>
        <Button variant="ghost" disabled={!pl?.length} onclick={() => ed.updateSurface({ plinth: null })}
          >Pas de plinthe</Button
        >
      </div>
      <div class="two">
        <NumberField
          label="Longueur à couvrir"
          value={pl?.length ?? 0}
          unit="cm"
          factor={10}
          min={0}
          onchange={(v) => setPlinth({ length: v })}
        />
        <NumberField
          label="Hauteur"
          value={pl?.height ?? 80}
          unit="cm"
          factor={10}
          min={1}
          step={0.5}
          onchange={(v) => setPlinth({ height: v })}
        />
      </div>
      {#if s.bands.length > 1}
        <Select
          label="Carreau de la bande"
          value={pl?.bandId ?? s.bands[0]!.id}
          options={s.bands.map((z, i) => ({
            value: z.id,
            label: `Bande ${i + 1} — ${carrelage.tile(z.tileId)?.name ?? ''}`,
          }))}
          onchange={(id) => setPlinth({ bandId: id })}
        />
      {/if}
      <p class="muted">
        {plinthPieces.length
          ? `${plinthPieces.length} pièces de ${cm(pl!.height)}, dont ${plinthReused} taillées dans les chutes. Le bord d’usine reste en haut, la coupe contre le sol.`
          : 'Indiquez une longueur pour calculer les plinthes. Elles sont taillées en priorité dans les chutes.'}
      </p>
    </section>
  {/if}

  <section aria-labelledby="f-cut">
    <h3 id="f-cut">Découpe et chutes</h3>
    <Checkbox
      label="Réutiliser les chutes de coupe"
      hint="Les pièces de même numéro sortent du même carreau."
      checked={settings.reuseOffcuts}
      onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { reuseOffcuts: v } })}
    />
    <Checkbox
      label="Numéros de coupe sur le plan"
      checked={app.showCutNumbers}
      onchange={(v) => app.setShowCutNumbers(v)}
    />
    <div class="two">
      <NumberField
        label="Perte par coupe"
        value={settings.kerf}
        unit="mm"
        min={0}
        step={0.5}
        onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { kerf: v } })}
      />
      <NumberField
        label="Chute minimale gardée"
        value={settings.minOffcut}
        unit="mm"
        min={1}
        step={5}
        onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { minOffcut: v } })}
      />
      <NumberField
        label="Marge de casse"
        value={settings.margin}
        unit="%"
        min={0}
        max={50}
        onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { margin: v } })}
      />
    </div>
    <p class="muted">
      Les pièces restent face émaillée dessus, jamais retournées. Le sens de rotation des chutes se règle sur le carreau
      (onglet Carreau, « Modifier ce carreau »).
    </p>
  </section>
</div>

<style>
  .tab {
    display: grid;
    gap: var(--space-5);
  }
  section {
    display: grid;
    gap: var(--space-3);
  }
  h3 {
    font-size: var(--fs-md);
  }
  .muted {
    font-size: var(--fs-sm);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
