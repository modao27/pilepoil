<script lang="ts">
  /**
   * Une face d'une cloison, vue de face à l'échelle : ossature (rails, montants pleins, doublés, courts), baies, plaques
   * numérotées d'une couche (chutes réemployées en couleur de réemploi), cotes de la longueur, de la hauteur et des baies.
   */
  import { STUD_DRAW, type Elevation, type ElevationPlate } from '../lib/elevation';

  let { elevation, plates, label }: { elevation: Elevation; plates: ElevationPlate[]; label: string } = $props();

  const pad = 300;
  const W = $derived(elevation.length);
  const H = $derived(elevation.height);
  // y vers le haut dans l'élévation, vers le bas dans le SVG
  const Y = (y: number) => H - y;
  const font = $derived(Math.max(70, Math.min(150, H / 18)));
  const cm = (mm: number) => (mm / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
</script>

<svg
  class="elev"
  viewBox="{-pad} {-pad * 0.4} {W + pad * 1.5} {H + pad * 2.1}"
  role="img"
  aria-label={label}
  preserveAspectRatio="xMidYMid meet"
>
  <rect class="panel" x="0" y="0" width={W} height={H} />

  {#each elevation.rails as r, i (i)}
    <rect class="metal" x={r.x0} y={Y(r.y1)} width={r.x1 - r.x0} height={r.y1 - r.y0} />
  {/each}
  {#each elevation.studs as s, i (i)}
    <rect
      class="metal stud {s.role}"
      x={s.x + s.dx - STUD_DRAW / 2}
      y={Y(s.y1)}
      width={STUD_DRAW}
      height={s.y1 - s.y0}
    />
  {/each}

  {#each plates as p (p.n)}
    <rect class="plate" class:reused={p.reused} x={p.x0} y={Y(p.y1)} width={p.x1 - p.x0} height={p.y1 - p.y0} />
    <text class="num" x={p.lx} y={Y(p.ly)} font-size={font} text-anchor="middle">{p.n}</text>
  {/each}

  {#each elevation.openings as o, i (i)}
    <rect class="opening" x={o.x0} y={Y(o.height)} width={o.x1 - o.x0} height={o.height} />
    <text class="dim" x={(o.x0 + o.x1) / 2} y={Y(o.height * 0.25)} font-size={font * 0.8} text-anchor="middle"
      >{cm(o.x1 - o.x0)}</text
    >
  {/each}

  <!-- cotes : longueur sous la cloison, hauteur à gauche -->
  <line class="cote" x1="0" y1={H + 110} x2={W} y2={H + 110} />
  <text class="dim" x={W / 2} y={H + 110 + font * 1.3} font-size={font} text-anchor="middle">{cm(W)} cm</text>
  <line class="cote" x1="-110" y1="0" x2="-110" y2={H} />
  <text
    class="dim"
    x="0"
    y="0"
    font-size={font}
    text-anchor="middle"
    transform="translate(-{110 + font * 0.9} {H / 2}) rotate(-90)">{cm(H)} cm</text
  >
</svg>

<style>
  .elev {
    display: block;
    width: 100%;
    height: auto;
    max-height: 70vh;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
  }
  .panel {
    fill: var(--sheet);
    stroke: var(--line);
    stroke-width: 8;
  }
  .metal {
    fill: color-mix(in srgb, var(--ink) 55%, var(--sheet));
    stroke: var(--ink);
    stroke-width: 4;
  }
  .stud.jamb,
  .stud.junction,
  .stud.start,
  .stud.end,
  .stud.corner {
    fill: var(--ink);
  }
  .plate {
    fill: color-mix(in srgb, var(--accent) 12%, transparent);
    stroke: var(--accent);
    stroke-width: 10;
  }
  .plate.reused {
    fill: color-mix(in srgb, var(--reuse) 35%, transparent);
    stroke: var(--reuse);
  }
  .opening {
    fill: var(--sheet);
    stroke: var(--ink);
    stroke-width: 8;
  }
  .num {
    font-family: var(--font-num);
    font-weight: 700;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--sheet);
    stroke-width: 18;
    dominant-baseline: central;
  }
  .dim {
    font-family: var(--font-num);
    fill: var(--ink);
    dominant-baseline: central;
  }
  .cote {
    stroke: var(--muted);
    stroke-width: 6;
  }
</style>
