<script lang="ts">
  /** Murs de la pose à plat : partie peinte à la couleur du produit, ouvertures en clair, cotes des murs. */
  import { ELEVATION_GAP, type Elevation } from '../lib/elevation';

  let { elevation, color, areas }: { elevation: Elevation; color: string; areas: Record<string, number> } = $props();

  const pad = ELEVATION_GAP;
  // y vers le haut dans l'élévation, vers le bas dans le SVG
  const flip = (h: number, y: number) => h - y;
  const path = (h: number, ring: [number, number][]) =>
    ring.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${flip(h, y)}`).join(' ') + ' Z';
  const m = (v: number) => (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
</script>

<svg
  class="elev"
  viewBox="{-pad} {-pad} {elevation.width + pad * 2} {elevation.height + pad * 3}"
  role="img"
  aria-label="Murs à peindre, à plat"
  preserveAspectRatio="xMidYMid meet"
>
  {#each elevation.walls as w (w.room + w.wall)}
    <g transform="translate({w.x0} 0)">
      <rect class="wall" x="0" y="0" width={w.length} height={w.height} />
      {#each w.painted as ring, i (i)}
        <path class="paint" d={path(w.height, ring)} fill={color} />
      {/each}
      {#each w.openings as o, i (i)}
        <rect
          class="opening"
          x={o.x}
          y={flip(w.height, o.y + o.height)}
          width={o.width}
          height={o.height}
          data-kind={o.kind}
        />
      {/each}
      <text class="label" x={w.length / 2} y={w.height + pad * 0.9} text-anchor="middle">
        {w.label} · {m(w.length)} m
      </text>
      <text class="area" x={w.length / 2} y={w.height + pad * 1.9} text-anchor="middle">
        {(areas[w.room + '~' + w.wall] ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m² à peindre
      </text>
    </g>
  {/each}
</svg>

<style>
  .elev {
    width: 100%;
    height: 100%;
    background: var(--paper);
  }
  .wall {
    fill: var(--sheet);
    stroke: var(--line);
    stroke-width: 12;
  }
  .paint {
    stroke: var(--ink);
    stroke-opacity: 0.35;
    stroke-width: 8;
  }
  .opening {
    fill: var(--paper);
    stroke: var(--ink);
    stroke-width: 10;
    stroke-dasharray: 40 30;
  }
  text {
    fill: var(--ink);
    font-size: 150px;
    font-family: inherit;
  }
  .area {
    fill: var(--muted);
    font-size: 130px;
  }
</style>
