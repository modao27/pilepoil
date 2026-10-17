<script lang="ts">
  /**
   * Relevé sur place : la pièce se saisit mur après mur (longueur, puis angle du coin qui suit), comme on la mesure.
   * Un aperçu se redessine à chaque saisie ; l'écart de fermeture et une diagonale de contrôle disent si les cotes
   * sont justes. `onoutline` reçoit le contour prêt à créer, ou null tant que la pièce ne ferme pas.
   */
  import type { Polygon } from '../../core/geometry/types';
  import { diagonalGap, surveyOutline, type SurveyWall } from '../../core/plan/survey';
  import { selfIntersecting } from '../../core/plan/validate';
  import { formatNumber } from '../lib/calc';
  import Button from '../components/Button.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Select from '../components/Select.svelte';

  let { onoutline }: { onoutline: (outline: Polygon | null) => void } = $props();

  type Corner = 'right' | 'reentrant' | 'measured';
  interface Row {
    length: number;
    corner: Corner;
    degrees: number;
  }
  /** Écart de fermeture absorbé par le dernier mur, mm : au-delà, la pièce est refusée. */
  const MAX_GAP = 50;

  let rows = $state<Row[]>([
    { length: 4000, corner: 'right', degrees: 90 },
    { length: 3000, corner: 'right', degrees: 90 },
    { length: 4000, corner: 'right', degrees: 90 },
    { length: 3000, corner: 'right', degrees: 90 },
  ]);
  const degreesOf = (r: Row) => (r.corner === 'right' ? 90 : r.corner === 'reentrant' ? 270 : r.degrees);

  const result = $derived(surveyOutline(rows.map((r): SurveyWall => ({ length: r.length, corner: degreesOf(r) }))));
  const crossing = $derived(!!result && selfIntersecting(result.outline));
  const closes = $derived(!!result && result.gap <= MAX_GAP);
  const problem = $derived(
    !result
      ? 'Saisissez au moins 3 murs, chacun avec une longueur.'
      : !closes
        ? `La pièce ne ferme pas : ${formatNumber(result.gap / 10)} cm d’écart entre le bout du dernier mur et le premier point. Vérifiez les longueurs et les angles.`
        : crossing
          ? 'Les murs se croisent : vérifiez les angles (droit ou rentrant).'
          : '',
  );
  const note = $derived(
    result && closes && result.gap >= 1
      ? `Écart de fermeture de ${formatNumber(result.gap / 10)} cm, absorbé par le dernier mur.`
      : '',
  );
  $effect(() => {
    onoutline(result && closes && !crossing ? result.outline : null);
  });

  function add() {
    rows.push({ length: 1000, corner: 'right', degrees: 90 });
  }

  /* diagonale de contrôle */
  let diagA = $state(0);
  let diagB = $state(2);
  let diagLength = $state(0);
  const corners = $derived(rows.map((_, i) => ({ value: i, label: `Coin ${i + 1}` })));
  const diag = $derived(result && diagLength > 0 ? diagonalGap(result.outline, diagA, diagB, diagLength) : null);

  /** Aperçu : contour (pointillé du bout du dernier mur au premier point si la pièce ne ferme pas). */
  const preview = $derived.by(() => {
    if (!result) return null;
    const pts = [...result.outline, result.end];
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    const span = Math.max(...xs) - Math.min(...xs);
    const pad = Math.max(300, span / 12);
    const x0 = Math.min(...xs) - pad,
      y0 = Math.min(...ys) - pad;
    return {
      box: `${x0} ${y0} ${span + 2 * pad} ${Math.max(...ys) - y0 + pad}`,
      points: result.outline.map((p) => p.join(',')).join(' '),
      end: result.end,
      start: result.outline[0]!,
      last: result.outline.at(-1)!,
      unit: (span + 2 * pad) / 150,
    };
  });
</script>

<div class="survey">
  <p class="muted">
    Mesurez mur après mur, en tournant autour de la pièce dans le sens des aiguilles d’une montre (le premier mur part
    vers la droite). Pour chaque coin, dites s’il est droit, rentrant ou mesuré.
  </p>

  <ol class="walls">
    {#each rows as r, i (i)}
      <li>
        <NumberField
          label="Mur {i + 1}"
          unit="cm"
          factor={10}
          min={1}
          max={10000}
          soft={{ min: 20, max: 3000 }}
          bind:value={r.length}
        />
        {#if i < rows.length - 1}
          <Segmented
            label="Coin après le mur {i + 1}"
            bind:value={r.corner}
            options={[
              { value: 'right', label: 'Droit' },
              { value: 'reentrant', label: 'Rentrant' },
              { value: 'measured', label: 'Mesuré' },
            ]}
          />
          {#if r.corner === 'measured'}
            <NumberField label="Angle du coin {i + 1}" unit="°" min={1} max={359} decimals={1} bind:value={r.degrees} />
          {/if}
        {:else}
          <p class="muted">Le dernier coin se ferme tout seul, sur le premier point.</p>
        {/if}
      </li>
    {/each}
  </ol>

  <div class="row">
    <Button icon="plus" onclick={add}>Ajouter un mur</Button>
    <Button variant="ghost" disabled={rows.length <= 3} onclick={() => rows.pop()}>Retirer le dernier mur</Button>
  </div>

  {#if preview}
    <svg class="preview" viewBox={preview.box} role="img" aria-label="Aperçu de la pièce relevée">
      <polygon points={preview.points} class:bad={!closes || crossing} />
      <circle cx={preview.start[0]} cy={preview.start[1]} r={preview.unit * 4} class="start" />
      {#if !closes}
        <line x1={preview.last[0]} y1={preview.last[1]} x2={preview.end[0]} y2={preview.end[1]} class="gap" />
      {/if}
    </svg>
  {/if}

  {#if problem}<p class="err" role="alert">{problem}</p>{:else if note}<p class="muted" role="status">{note}</p>{/if}

  <details class="diag">
    <summary>Contrôler avec une diagonale</summary>
    <p class="muted">Mesurez la distance entre deux coins : l’écart avec le plan dit si les cotes sont justes.</p>
    <div class="pair">
      <Select label="De" bind:value={diagA} options={corners} />
      <Select label="À" bind:value={diagB} options={corners} />
    </div>
    <NumberField label="Longueur mesurée" unit="cm" factor={10} min={0} max={20000} bind:value={diagLength} />
    {#if diag != null}
      <p class:err={Math.abs(diag) > 20} role="status">
        {Math.abs(diag) < 1
          ? 'La diagonale correspond au plan.'
          : `Écart de ${diag > 0 ? '+' : '−'}${formatNumber(Math.abs(diag))} mm avec le plan${Math.abs(diag) > 20 ? ' : une cote ou un angle est faux.' : ' : correct pour un relevé.'}`}
      </p>
    {/if}
  </details>
</div>

<style>
  .survey {
    display: grid;
    gap: var(--space-3);
  }
  .walls {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
  }
  .walls li {
    display: grid;
    gap: var(--space-2);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--line);
  }
  .row,
  .pair {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .pair > :global(*) {
    flex: 1 1 140px;
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--muted);
  }
  .err {
    color: var(--color-error);
  }
  .preview {
    width: 100%;
    max-height: 240px;
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--paper);
  }
  .preview polygon {
    fill: var(--accent-soft);
    stroke: var(--ink);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .preview polygon.bad {
    stroke: var(--color-error);
  }
  .preview .start {
    fill: var(--accent);
  }
  .preview .gap {
    stroke: var(--color-error);
    stroke-width: 2px;
    stroke-dasharray: 6 6;
    vector-effect: non-scaling-stroke;
  }
  .diag {
    display: grid;
    gap: var(--space-2);
  }
  .diag summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: 500;
  }
</style>
