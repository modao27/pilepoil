<script lang="ts">
  import { onMount } from 'svelte';
  /**
   * Dessin d'une pièce pour l'écran Pièce : le sol au centre, chaque mur déplié vers l'extérieur le long de son
   * segment. Les zones sont colorées par pose (motif propre à chaque couleur, lisible sans elle), les parties sans
   * revêtement hachurées. Toucher le sol ou un mur le sélectionne ; en mode découpe, deux touchers sur le sol
   * donnent une ligne (repère de la pièce). Rendu seul : les modifications passent par `onselect` et `oncutpoint`.
   */
  import { sameSurface, zoneRegion, type SurfaceRef } from '../../core/coverage';
  import type { Point, Polygon } from '../../core/geometry/types';
  import type { PlanRoom } from '../../core/plan/types';
  import { wallLength } from '../../core/plan/walls';
  import { wallHeight } from '../../core/plan/levels';
  import { boxOf, unfoldWall } from '../../render/roomTop';
  import type { Project } from '../../state/model';
  import { poseColor } from './colors';

  let {
    project,
    room,
    selected,
    cutting = false,
    cut = [],
    contour = false,
    onselect,
    oncutpoint,
  }: {
    project: Project;
    room: PlanRoom;
    selected: SurfaceRef | null;
    cutting?: boolean;
    /** Points déjà touchés de la ligne ou du contour de découpe (repère de la pièce). */
    cut?: Point[];
    /** Les points forment un contour en cours (tracé reliant les points). */
    contour?: boolean;
    onselect: (s: SurfaceRef) => void;
    oncutpoint?: (p: Point) => void;
  } = $props();

  const uid = Math.random().toString(36).slice(2);
  const floorRef = $derived<SurfaceRef>({ room: room.id, wall: null });
  const poseIndex = $derived(new Map(project.poses.map((p, i) => [p.id, i])));
  const poseName = (id: string) => project.poses.find((p) => p.id === id)?.name ?? '';
  const d = (ring: readonly Point[]) => 'M' + ring.map((p) => `${p[0]} ${p[1]}`).join(' L') + ' Z';
  const zonesOn = (s: SurfaceRef) => project.zones.filter((z) => sameSurface(z.surface, s));

  /** Murs dépliés : matrice (repère du mur, y vers le bas depuis le plafond → pièce), taille, zones. */
  const walls = $derived(
    room.walls.map((w, i) => {
      const L = wallLength(room, i),
        H = wallHeight(room, w);
      const ref = { room: room.id, wall: w.id };
      const zones = zonesOn(ref).map((z) => ({
        z,
        // repère du mur (y vers le haut) → repère du dessin déplié (y vers le bas depuis le haut du mur)
        rings: (zoneRegion(project.plan, z) ?? []).map((r): Polygon => r.map((q): Point => [q[0], H - q[1]])),
      }));
      return { i, ref, L, H, zones, ...unfoldWall(room.outline, i, L, H) };
    }),
  );
  const floorZones = $derived(zonesOn(floorRef).map((z) => ({ z, rings: zoneRegion(project.plan, z) ?? [] })));
  const size = $derived.by(() => {
    const xs = room.outline.map((p) => p[0]),
      ys = room.outline.map((p) => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  });
  const font = $derived(size / 18);
  const boxArr = $derived(boxOf([...room.outline, ...walls.flatMap((w) => w.corners)], font * 2));
  const box = $derived(boxArr.join(' '));
  /** Largeur affichée du dessin, px : donne la taille d'une unité du dessin à l'écran. */
  let drawnWidth = $state(0);
  /** 44 px (cible tactile) exprimés en unités du dessin. */
  const touchMin = $derived(drawnWidth > 0 ? (48 * boxArr[2]!) / drawnWidth : 0);

  const isSel = (s: SurfaceRef) => !!selected && sameSurface(selected, s);
  const label = (s: SurfaceRef, name: string) => {
    const zs = zonesOn(s);
    if (!zs.length) return `${name} : sans revêtement`;
    return `${name} : ${[...new Set(zs.map((z) => poseName(z.pose)))].join(', ')}`;
  };
  const centre = (rings: Polygon[]): Point => {
    const pts = rings.flat();
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  };
  const key = (s: SurfaceRef) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onselect(s);
    }
  };

  let svg: SVGSVGElement;
  onMount(() => {
    const ro = new ResizeObserver(() => (drawnWidth = svg.getBoundingClientRect().width));
    ro.observe(svg);
    return () => ro.disconnect();
  });
  /** Toucher sur le sol en mode découpe : point dans le repère de la pièce. */
  function floorDown(e: PointerEvent) {
    if (!cutting) return onselect(floorRef);
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    oncutpoint?.([Math.round(p.x), Math.round(p.y)]);
  }
</script>

<svg
  bind:this={svg}
  class="room"
  class:cutting
  viewBox={box}
  role="group"
  aria-label="{room.name} : sol au centre, murs dépliés autour"
>
  <defs>
    <pattern
      id="bare-{uid}"
      width={font / 1.5}
      height={font / 1.5}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line x1="0" y1="0" x2="0" y2={font / 1.5} class="hatch" />
    </pattern>
  </defs>

  {#each walls as w (w.ref.wall)}
    <g
      class="surface"
      class:sel={isSel(w.ref)}
      role="button"
      tabindex="0"
      aria-pressed={isSel(w.ref)}
      aria-label={label(w.ref, `Mur ${w.i + 1}`)}
      onclick={() => onselect(w.ref)}
      onkeydown={key(w.ref)}
    >
      <g transform="matrix({w.matrix.join(' ')})">
        <!-- zone de toucher élargie autour d'un mur fin (44 px mini), invisible -->
        <rect
          class="hit"
          x={-Math.max(0, (touchMin - w.L) / 2)}
          y={-Math.max(0, (touchMin - w.H) / 2)}
          width={Math.max(w.L, touchMin)}
          height={Math.max(w.H, touchMin)}
        />
        <rect class="bare" x="0" y="0" width={w.L} height={w.H} fill="url(#bare-{uid})" />
        {#each w.zones as zz (zz.z.id)}
          {#each zz.rings as r, k (k)}<path
              class="zone"
              d={d(r)}
              fill={poseColor(poseIndex.get(zz.z.pose) ?? 0)}
            />{/each}
        {/each}
        <rect class="edge" x="0" y="0" width={w.L} height={w.H} />
      </g>
      <text
        x={centre([w.corners])[0]}
        y={centre([w.corners])[1]}
        font-size={font}
        text-anchor="middle"
        dominant-baseline="middle">{w.i + 1}</text
      >
    </g>
  {/each}

  <g
    class="surface"
    class:sel={isSel(floorRef)}
    role="button"
    tabindex="0"
    aria-pressed={isSel(floorRef)}
    aria-label={label(floorRef, 'Sol')}
    onpointerdown={floorDown}
    onkeydown={key(floorRef)}
  >
    <path class="bare" d={d(room.outline)} fill="url(#bare-{uid})" />
    {#each room.obstacles as o (o.id)}<path class="obstacle" d={d(o.outline)} />{/each}
    {#each floorZones as zz (zz.z.id)}
      {#each zz.rings as r, k (k)}<path class="zone" d={d(r)} fill={poseColor(poseIndex.get(zz.z.pose) ?? 0)} />{/each}
      {#if zz.rings.length}
        {@const c = centre(zz.rings)}
        <text x={c[0]} y={c[1]} font-size={font * 0.8} text-anchor="middle" dominant-baseline="middle"
          >{poseName(zz.z.pose)}</text
        >
      {/if}
    {/each}
    <path class="edge" d={d(room.outline)} />
  </g>

  {#if cut.length}
    {#if contour && cut.length > 1}
      <polyline class="cutline" points={cut.map((p) => p.join(',')).join(' ')} />
    {/if}
    {#each cut as p, k (k)}<circle class="cutpt" class:first={k === 0} cx={p[0]} cy={p[1]} r={font / 3} />{/each}
  {/if}
</svg>

<style>
  .room {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: manipulation;
  }
  .surface {
    cursor: pointer;
  }
  .surface:focus-visible {
    outline: none;
  }
  .bare {
    stroke: none;
  }
  .hit {
    fill: transparent;
    stroke: none;
  }
  .hatch {
    stroke: var(--line);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .zone {
    stroke: var(--ink);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0.85;
  }
  .obstacle {
    fill: var(--paper);
    stroke: var(--muted);
    vector-effect: non-scaling-stroke;
  }
  .edge {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .surface.sel .edge,
  .surface:focus-visible .edge,
  .surface:hover .edge {
    stroke: var(--accent);
    stroke-width: 4;
  }
  text {
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 3px;
    pointer-events: none;
  }
  .cutting .surface {
    cursor: crosshair;
  }
  .cutpt {
    fill: var(--accent);
    pointer-events: none;
  }
  .cutpt.first {
    stroke: var(--ink);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .cutline {
    fill: none;
    stroke: var(--accent);
    stroke-width: 3;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
</style>
