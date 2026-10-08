<script lang="ts">
  /** Vignette du plan d'ensemble (lecture seule) : pièces, murs, passages. */
  import { planBounds } from '../../core/plan/snap';
  import type { Plan, PlanRoom } from '../../core/plan/types';
  import { wallBands } from '../../core/plan/walls';

  let { plan, label }: { plan: Plan; label: string } = $props();

  const b = $derived(planBounds(plan));
  const pad = 400;
  const vb = $derived(
    b ? `${b[0] - pad} ${b[2] - pad} ${b[1] - b[0] + 2 * pad} ${b[3] - b[2] + 2 * pad}` : '0 0 4000 3000',
  );
  const pts = (r: PlanRoom, poly: [number, number][]) =>
    poly.map(([x, y]) => `${r.origin[0] + x},${r.origin[1] + y}`).join(' ');
</script>

<svg class="thumb" viewBox={vb} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
  {#each plan.rooms as r (r.id)}
    <polygon class="floor" points={pts(r, r.outline)} />
    {#each wallBands(r) as band, i (i)}<polygon class="wall" points={pts(r, band)} />{/each}
    {#each r.obstacles as o (o.id)}<polygon class="obstacle" points={pts(r, o.outline)} />{/each}
  {/each}
</svg>

<style>
  .thumb {
    display: block;
    width: 100%;
    height: 100%;
  }
  .floor {
    fill: color-mix(in srgb, var(--accent) 8%, var(--sheet));
  }
  .wall {
    fill: var(--muted);
  }
  .obstacle {
    fill: var(--line);
  }
</style>
