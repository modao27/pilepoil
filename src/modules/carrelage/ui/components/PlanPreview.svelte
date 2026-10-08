<script lang="ts">
  import type { CutPlan, Piece, SurfaceSpec } from '../../core';
  import { planDrawing, type PlanMode } from '../../../../render/planSvg';

  let {
    surface,
    pieces,
    plan = null,
    offset = 0,
    mode = 'tiles',
    grout = '#8f8a83',
    label,
  }: {
    surface: SurfaceSpec;
    pieces: Piece[];
    plan?: CutPlan | null;
    offset?: number;
    mode?: PlanMode;
    grout?: string;
    label: string;
  } = $props();

  const drawing = $derived(planDrawing(surface, pieces, plan, offset));
  const STATUS = { full: 'var(--sheet)', cut: 'var(--cut)', reuse: 'var(--reuse)', thin: 'var(--thin)' };
</script>

<svg class="plan" viewBox={drawing.viewBox} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
  <rect width={drawing.width} height={drawing.height} fill={mode === 'tiles' ? grout : 'var(--line)'} />
  {#each drawing.shapes as s, i (i)}
    <path d={s.d} fill={mode === 'tiles' ? s.fill : STATUS[s.status]} />
  {/each}
  {#each drawing.holes as h, i (i)}
    <path class="hole" d={h} />
  {/each}
  <rect class="edge" width={drawing.width} height={drawing.height} />
</svg>

<style>
  .plan {
    display: block;
    width: 100%;
    height: 100%;
    max-height: 100%;
  }
  .hole {
    fill: var(--paper);
    stroke: var(--muted);
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
  }
  .edge {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
</style>
