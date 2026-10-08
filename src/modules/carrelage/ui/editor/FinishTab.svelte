<script lang="ts">
  import type { Edges } from '../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { cm } from '../../../../ui/lib/format';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const s = $derived(ed.surface);
  const c = $derived(s.corners[ed.sel.corner]);
  const pl = $derived(s.plinth);
  const plinthPieces = $derived(ed.build?.pieces.map((p, i) => [p, i] as const).filter(([p]) => p.plinth) ?? []);
  const plinthReused = $derived(plinthPieces.filter(([, i]) => ed.result?.plan.reused[ed.offset + i]).length);
  const settings = $derived(ed.project.settings);

  const setEdge = (k: keyof Edges, v: boolean) => ed.updateSurface({ hiddenEdges: { ...s.hiddenEdges, [k]: v } });
  const setPlinth = (p: Partial<NonNullable<typeof pl>>) =>
    ed.updateSurface({ plinth: { length: 0, height: 80, zoneId: s.zones[0]!.id, ...(pl ?? {}), ...p } });
</script>

<div class="tab">
  {#if s.kind === 'wall'}
    <section aria-labelledby="f-corners">
      <h3 id="f-corners">Angles du mur</h3>
      {#if s.corners.length}
        <div class="list">
          {#each s.corners as k, i (k.id)}
            <button type="button" aria-pressed={i === ed.sel.corner} onclick={() => ed.select({ corner: i })}>
              <strong>Angle {i + 1}</strong>
              <span class="muted">{k.type === 'in' ? 'rentrant' : 'sortant'}, {cm(k.x)}</span>
            </button>
          {/each}
        </div>
      {/if}
      <p class="muted">Le carrelage continue d’un mur à l’autre ; les carreaux sont coupés dans l’angle.</p>
      <div><Button icon="plus" onclick={() => ed.addCorner()}>Ajouter un angle</Button></div>
      {#if c}
        <div class="two">
          <NumberField
            label="Position depuis la gauche"
            value={c.x}
            unit="cm"
            factor={10}
            min={1}
            max={s.width / 10}
            onchange={(v) => ed.updateCorner({ x: v })}
          />
          <NumberField
            label="Angle de la pièce"
            value={c.angle}
            unit="°"
            min={30}
            max={170}
            onchange={(v) => ed.updateCorner({ angle: v })}
          />
        </div>
        <Segmented
          label="Type d’angle"
          value={c.type}
          onchange={(t) => ed.updateCorner({ type: t })}
          options={[
            { value: 'in', label: 'Rentrant (coin)' },
            { value: 'out', label: 'Sortant (arête)' },
          ]}
        />
        {#if c.type === 'out'}
          <Checkbox
            label="Arête protégée par un profilé"
            checked={c.covered}
            onchange={(v) => ed.updateCorner({ covered: v })}
          />
        {/if}
        <div><Button variant="danger" icon="trash" onclick={() => ed.removeCorner()}>Supprimer l’angle</Button></div>
      {/if}
    </section>
  {/if}

  <section aria-labelledby="f-edges">
    <h3 id="f-edges">Bords cachés</h3>
    <p class="muted">
      Cochez les bords masqués par une plinthe, un angle ou un meuble : les coupes y vont en priorité.
    </p>
    <div class="two">
      <Checkbox label="Haut" checked={s.hiddenEdges.top} onchange={(v) => setEdge('top', v)} />
      <Checkbox label="Bas" checked={s.hiddenEdges.bottom} onchange={(v) => setEdge('bottom', v)} />
      <Checkbox label="Gauche" checked={s.hiddenEdges.left} onchange={(v) => setEdge('left', v)} />
      <Checkbox label="Droite" checked={s.hiddenEdges.right} onchange={(v) => setEdge('right', v)} />
    </div>
    {#if s.zones.length > 1}
      <Checkbox
        label="Jonctions entre zones recouvertes"
        hint="Listel ou profilé entre les zones."
        checked={s.junctionsCovered}
        onchange={(v) => ed.updateSurface({ junctionsCovered: v })}
      />
    {/if}
  </section>

  <section aria-labelledby="f-plinth">
    <h3 id="f-plinth">Plinthes en carrelage</h3>
    <div class="row">
      <Button onclick={() => setPlinth({ length: 2 * (s.width + s.height) })}>Périmètre</Button>
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
    {#if s.zones.length > 1}
      <Select
        label="Carreau de la zone"
        value={pl?.zoneId ?? s.zones[0]!.id}
        options={s.zones.map((z, i) => ({
          value: z.id,
          label: `Zone ${i + 1} — ${carrelage.tile(z.tileId)?.name ?? ''}`,
        }))}
        onchange={(id) => setPlinth({ zoneId: id })}
      />
    {/if}
    <p class="muted">
      {plinthPieces.length
        ? `${plinthPieces.length} pièces de ${cm(pl!.height)}, dont ${plinthReused} taillées dans les chutes. Le bord d’usine reste en haut, la coupe contre le sol.`
        : 'Indiquez une longueur pour calculer les plinthes. Elles sont taillées en priorité dans les chutes.'}
    </p>
  </section>

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
  .row,
  .list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .list button {
    display: grid;
    min-height: var(--touch);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .list button[aria-pressed='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    background: var(--accent-soft);
  }
</style>
