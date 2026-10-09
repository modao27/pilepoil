<script lang="ts">
  /**
   * Assistant de démarrage : la pièce (rectangle, L ou U) est dessinée dans le plan, on coche le sol et les murs
   * à carreler, puis carreau et motif ; aperçu en direct. Le projet s'ouvre sur l'écran Carrelage.
   */
  import { PATTERNS, type PatternId, type ProjectResult } from '../../core';
  import { createTile, tileName } from '../../state/factories';
  import type { Tile } from '../../state/model';
  import { carrelageView } from '../../state/data';
  import type { Project } from '../../../../state/model';
  import { toProjectSpec } from '../../state/selectors';
  import { createWizardProject, formRoom, validForm, type RoomForm } from '../../state/templates';
  import { wallLength } from '../../../../core/plan/walls';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import PatternPicker from '../components/PatternPicker.svelte';
  import PlanPreview from '../components/PlanPreview.svelte';
  import RoomWalls from '../components/RoomWalls.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import TileForm from '../components/TileForm.svelte';
  import TileSwatch from '../components/TileSwatch.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { cm, count, mm, tileSize } from '../../../../ui/lib/format';
  import { go } from '../../../../ui/lib/router.svelte';

  type Shape = RoomForm['kind'];
  const STEPS = ['Pièce', 'À carreler', 'Carreau', 'Motif'] as const;

  let step = $state(0);
  let shape = $state<Shape>('rect');
  const dims = $state({ length: 3000, width: 2400, cutLength: 1200, cutWidth: 1000, arm: 900, depth: 1000 });
  let height = $state(2500);
  let tiledHeight = $state(2000);
  let floor = $state(true);
  let walls = $state<number[]>([]);
  let tileId = $state<string | null>(carrelage.tiles[0]?.id ?? null);
  let creating = $state(carrelage.tiles.length === 0);
  let draft = $state<Tile>(createTile({ name: '' }));
  let joint = $state(3);
  let upright = $state(false);
  let pattern = $state<PatternId>('half');
  let angle = $state(0);
  let name = $state('');
  let error = $state('');
  let saving = $state(false);

  const form = $derived.by<RoomForm>(() => {
    const { length, width } = dims;
    if (shape === 'l') return { kind: 'l', length, width, cutLength: dims.cutLength, cutWidth: dims.cutWidth };
    if (shape === 'u') return { kind: 'u', length, width, arm: dims.arm, depth: dims.depth };
    return { kind: 'rect', length, width };
  });
  /** Pièce dessinée (aperçu des murs numérotés). */
  const room = $derived(validForm(form) ? formRoom(form, { name: 'Pièce', height }) : null);

  // changer de forme change le nombre de murs : on ne garde que ceux qui existent
  $effect(() => {
    const n = room?.walls.length ?? 0;
    if (walls.some((k) => k >= n)) walls = walls.filter((k) => k < n);
  });

  const tile = $derived((tileId && carrelage.tile(tileId)) || undefined);
  /** Carreau de l'aperçu : celui choisi, sinon le brouillon en cours de saisie. */
  const shown = $derived<Tile>(tile ?? $state.snapshot(draft));
  const allowed = $derived(PATTERNS.filter((p) => p.shape === shown.shape));
  const regular = $derived(shown.shape === 'hex' || shown.shape === 'octo');

  $effect(() => {
    if (!allowed.some((p) => p.id === pattern)) pattern = allowed[0]!.id;
  });

  function build(t: Tile): Project | null {
    if (!validForm(form)) return null;
    const layout = { tileId: t.id, tileUpright: !regular && upright, pattern, angle, joint };
    return createWizardProject({ ...layout, form, height, tiledHeight, floor, walls, name }, 0);
  }

  const doc = $derived(build(shown));
  const project = $derived(doc && carrelageView(doc));
  let preview = $state.raw<ProjectResult | null>(null);
  let previewSpec = $state.raw<ReturnType<typeof toProjectSpec>['spec'] | null>(null);
  $effect(() => {
    if (!project?.surfaces.length) return;
    const spec = toProjectSpec(project, [...carrelage.tiles.filter((t) => t.id !== shown.id), shown]).spec;
    void carrelage.computeLive(spec).then((r) => {
      if (r) {
        preview = r;
        previewSpec = spec;
      }
    });
  });
  const first = $derived(preview?.surfaces[0]);

  function toggleWall(k: number, on: boolean) {
    walls = on ? [...walls, k].sort((a, b) => a - b) : walls.filter((x) => x !== k);
  }

  function validate(): string {
    if (step === 0) {
      if (!validForm(form) || !(height > 0))
        return 'Indiquez des cotes positives ; un retrait plus petit que la pièce.';
    }
    if (step === 1) {
      if (!floor && !walls.length) return 'Choisissez le sol ou au moins un mur.';
      if (walls.length && !(tiledHeight > 0)) return 'Indiquez la hauteur carrelée des murs.';
    }
    if (step === 2 && !tile)
      return creating ? 'Ajoutez le carreau, ou choisissez-en un dans la liste.' : 'Choisissez un carreau.';
    return '';
  }

  function next() {
    error = validate();
    if (!error) step++;
  }

  async function create() {
    if (!tile || saving) return;
    const p = build(tile);
    if (!p) return;
    saving = true;
    const now = Date.now();
    await app.saveProject({ ...p, createdAt: now, updatedAt: now });
    go({ name: 'module', id: p.id, module: 'carrelage', path: '' }, true);
  }
</script>

<Screen title="Nouveau projet" backHref="#/" backLabel="Annuler et revenir à l’accueil" wide>
  <div class="wiz">
    <aside class="preview" aria-label="Aperçu">
      {#if step < 2 || !project?.surfaces.length}
        <div class="plan walls">
          {#if room}
            <RoomWalls
              {room}
              {floor}
              walls={walls.map((k) => room.walls[k]!.id)}
              label="Pièce dessinée, murs numérotés"
            />
          {/if}
        </div>
        <p class="cap"><span>Pièce de {cm(dims.length)} sur {cm(dims.width)}</span></p>
      {:else}
        <div
          class="plan"
          style="aspect-ratio: {previewSpec?.surfaces[0]?.width || 4} / {previewSpec?.surfaces[0]?.height || 3}"
        >
          {#if first?.ok && previewSpec}
            <PlanPreview
              surface={previewSpec.surfaces[0]!}
              pieces={first.value.pieces}
              grout="#8f8a83"
              label="Aperçu de {project.surfaces[0]!.name}"
            />
          {/if}
        </div>
        <p class="cap">
          <span
            >{project.surfaces[0]!.name}{project.surfaces.length > 1 ? ` (+ ${project.surfaces.length - 1})` : ''}</span
          >
          {#if preview}<span class="num">≈ {count(preview.metrics.order, 'carreau', 'carreaux')}</span>{/if}
        </p>
      {/if}
    </aside>

    <div class="form">
      <div class="progress">
        <p><strong>Étape {step + 1} sur {STEPS.length}</strong> · {STEPS[step]}</p>
        <div
          class="bar"
          role="progressbar"
          aria-label="Avancement"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <span style="width: {((step + 1) / STEPS.length) * 100}%"></span>
        </div>
      </div>

      {#if step === 0}
        <h2>La pièce</h2>
        <Segmented
          label="Forme de la pièce"
          bind:value={shape}
          options={[
            { value: 'rect', label: 'Rectangle' },
            { value: 'l', label: 'En L' },
            { value: 'u', label: 'En U' },
          ]}
        />
        <div class="two">
          <NumberField
            label="Longueur de la pièce"
            bind:value={dims.length}
            unit="cm"
            factor={10}
            min={1}
            hint="Calcul accepté : 300-12"
          />
          <NumberField label="Largeur de la pièce" bind:value={dims.width} unit="cm" factor={10} min={1} />
          {#if shape === 'l'}
            <NumberField label="Retrait en longueur" bind:value={dims.cutLength} unit="cm" factor={10} min={1} />
            <NumberField label="Retrait en largeur" bind:value={dims.cutWidth} unit="cm" factor={10} min={1} />
          {:else if shape === 'u'}
            <NumberField label="Largeur des ailes" bind:value={dims.arm} unit="cm" factor={10} min={1} />
            <NumberField label="Profondeur de l’encoche" bind:value={dims.depth} unit="cm" factor={10} min={1} />
          {/if}
          <NumberField label="Hauteur sous plafond" bind:value={height} unit="cm" factor={10} min={1} />
        </div>
        <p class="muted small">
          La pièce est ajoutée au plan du projet. Forme libre, portes et fenêtres : dans le plan, après la création.
        </p>
      {:else if step === 1}
        <h2>À carreler</h2>
        {#if room}
          <fieldset>
            <legend>Sol et murs</legend>
            <Checkbox label="Sol" bind:checked={floor} />
            {#each room.walls as w, k (w.id)}
              <Checkbox
                label="Mur {k + 1}"
                hint={cm(wallLength(room, k))}
                checked={walls.includes(k)}
                onchange={(v) => toggleWall(k, v)}
              />
            {/each}
          </fieldset>
        {/if}
        {#if walls.length}
          <div class="two">
            <NumberField
              label="Hauteur carrelée"
              bind:value={tiledHeight}
              unit="cm"
              factor={10}
              min={1}
              hint="Hauteur de carrelage sur les murs."
            />
          </div>
        {/if}
      {:else if step === 2}
        <h2>Carreau</h2>
        {#if creating}
          <TileForm
            bind:tile={draft}
            submitLabel="Ajouter ce carreau"
            onsubmit={(t) => {
              carrelage.putTile(t);
              tileId = t.id;
              creating = false;
              error = '';
            }}
          >
            {#snippet extra()}
              {#if carrelage.tiles.length}<Button variant="ghost" onclick={() => (creating = false)}
                  >Choisir dans la bibliothèque</Button
                >{/if}
            {/snippet}
          </TileForm>
        {:else}
          <div class="tiles" role="radiogroup" aria-label="Carreau de la bibliothèque">
            {#each carrelage.tiles as t (t.id)}
              <button
                type="button"
                role="radio"
                aria-checked={tileId === t.id}
                onclick={() => ((tileId = t.id), (error = ''))}
              >
                <TileSwatch tile={t} size={40} />
                <span class="tt"
                  ><strong>{t.name}</strong><span class="muted"
                    >{t.name === tileName(t.shape, t.length, t.width)
                      ? ''
                      : tileSize(t.length, t.width, t.shape) + ' · '}ép.
                    {mm(t.thickness)}{t.m2PerBox > 0 ? ` · ${t.m2PerBox.toLocaleString('fr-FR')} m²/carton` : ''}</span
                  ></span
                >
              </button>
            {/each}
          </div>
          <Button icon="plus" onclick={() => ((draft = createTile({ name: '' })), (creating = true), (tileId = null))}
            >Nouveau carreau</Button
          >
          <div class="two">
            <NumberField label="Joint" bind:value={joint} unit="mm" min={0} max={20} step={0.5} />
          </div>
          {#if tile && !regular}
            <Checkbox label="Pose debout" hint="Long côté vertical (sinon horizontal)." bind:checked={upright} />
          {/if}
        {/if}
      {:else}
        <h2>Motif</h2>
        <PatternPicker bind:value={pattern} shape={shown.shape} />
        <div class="field">
          <span class="lbl">Orientation</span>
          <Segmented
            label="Orientation du motif"
            bind:value={angle}
            options={[0, 30, 45, 60, 90].map((a) => ({ value: a, label: a + '°' }))}
          />
        </div>
        <TextField
          label="Nom du projet"
          bind:value={name}
          placeholder={doc?.name ?? ''}
          maxlength={60}
          hint="Facultatif."
        />
        <p class="muted small">Joint {mm(joint)}. Vous pourrez tout modifier ensuite.</p>
      {/if}

      {#if error}<p class="err" role="alert">{error}</p>{/if}

      <div class="nav">
        {#if step > 0}<Button icon="back" onclick={() => ((step -= 1), (error = ''))}>Précédent</Button>{:else}<span
          ></span>{/if}
        {#if step < STEPS.length - 1}
          <Button variant="primary" onclick={next}>Suivant</Button>
        {:else}
          <Button variant="primary" icon="check" disabled={saving} onclick={create}>Créer le projet</Button>
        {/if}
      </div>
    </div>
  </div>
</Screen>

<style>
  .wiz {
    display: grid;
    gap: var(--space-4);
  }
  @media (min-width: 900px) {
    .wiz {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
    .preview {
      order: 2;
      position: sticky;
      top: 72px;
    }
  }
  .preview {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .plan {
    width: 100%;
    min-height: 120px;
    max-height: 32dvh;
    display: grid;
    place-items: center;
  }
  @media (min-width: 900px) {
    .plan {
      max-height: 60dvh;
    }
  }
  .cap {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--fs-sm);
  }
  .cap .num {
    font-size: var(--fs-md);
    font-weight: 600;
  }
  .form {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }
  .progress {
    display: grid;
    gap: var(--space-2);
    font-size: var(--fs-sm);
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--line);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width var(--dur);
  }
  .tiles {
    display: grid;
    gap: var(--space-2);
  }
  .tiles button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .tiles button[aria-checked='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    background: var(--accent-soft);
  }
  .tt {
    display: grid;
  }
  .muted {
    font-size: var(--fs-sm);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
  }
  fieldset {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    font-size: var(--fs-sm);
    font-weight: 500;
    margin-bottom: var(--space-1);
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  .lbl {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .small {
    font-size: var(--fs-xs);
  }
  .err {
    color: var(--thin-ink);
  }
  .nav {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) 0 calc(var(--space-3) + env(safe-area-inset-bottom));
    background: var(--paper);
    border-top: 1px solid var(--line);
  }
  .plan.walls {
    aspect-ratio: 4 / 3;
  }
</style>
