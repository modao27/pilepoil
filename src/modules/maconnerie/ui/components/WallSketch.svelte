<script lang="ts">
  /** Élévation d'un mur maçonné : base, zones numérotées, portes et baies, cotes. Lecture seule ; mm. */
  import type { Rect } from '../../core/types';

  let {
    length,
    height,
    zones,
    holes,
    label,
  }: { length: number; height: number; zones: (Rect & { glass: boolean })[]; holes: Rect[]; label: string } = $props();

  const pad = $derived(Math.max(length, height) * 0.08);
  // y vers le haut dans le mur, vers le bas à l'écran
  const top = (r: Rect) => height - r.y - r.height;
  const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
</script>

<svg
  viewBox="{-pad} {-pad} {length + 2 * pad} {height + 2 * pad}"
  role="img"
  aria-label={label}
  preserveAspectRatio="xMidYMid meet"
>
  <rect class="wall" x="0" y="0" width={length} {height} vector-effect="non-scaling-stroke" />
  {#each holes as o, i (i)}
    <rect class="hole" x={o.x} y={top(o)} width={o.width} height={o.height} vector-effect="non-scaling-stroke" />
  {/each}
  {#each zones as z, i (i)}
    <rect
      class="zone"
      class:glass={z.glass}
      x={z.x}
      y={top(z)}
      width={z.width}
      height={z.height}
      vector-effect="non-scaling-stroke"
    />
    <text class="n" x={z.x + z.width / 2} y={top(z) + z.height / 2} font-size={pad * 0.9}>{i + 1}</text>
  {/each}
  <text class="dim" x={length / 2} y={height + pad * 0.75} font-size={pad * 0.6}>{fr(length / 10)} cm</text>
  <text
    class="dim"
    x={-pad * 0.3}
    y={height / 2}
    font-size={pad * 0.6}
    transform="rotate(-90 {-pad * 0.3} {height / 2})">{fr(height / 10)} cm</text
  >
</svg>

<style>
  svg {
    width: 100%;
    max-height: 220px;
  }
  .wall {
    fill: color-mix(in srgb, var(--color-highlight) 22%, var(--sheet));
    stroke: var(--ink);
    stroke-width: 1.5;
  }
  .hole {
    fill: var(--sheet);
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .zone {
    fill: color-mix(in srgb, var(--color-accent) 30%, var(--sheet));
    stroke: var(--ink);
    stroke-width: 1;
  }
  .zone.glass {
    fill: color-mix(in srgb, var(--color-primary) 22%, var(--sheet));
  }
  text {
    fill: var(--ink);
    text-anchor: middle;
    dominant-baseline: middle;
    font-family: var(--font-ui);
  }
  .dim {
    fill: var(--muted);
  }
</style>
