<script lang="ts">
  /**
   * Vue 3D partagée (three.js chargé à la demande) : le module fournit ses maillages (`build`) et le cadre de
   * la scène. Glisser pour tourner, pincer ou molette pour zoomer, deux doigts pour déplacer. Clavier : flèches
   * pour tourner, + / − pour zoomer. Avec `walls` : murs pleins, bas ou coupés côté caméra (maison de poupée) ;
   * avec `onpick` : un toucher sans glisser donne le point du sol (x, z en m). `preview` : image fixe, sans outils.
   */
  import { onMount } from 'svelte';
  import type { CameraPreset } from '../../render/scene3d/camera';
  import type { Scene3D, SceneStats, WallMode } from '../../render/scene3d/scene';
  import type { MeshData, SceneFrame } from '../../render/scene3d/types';
  import IconButton from './IconButton.svelte';
  import Segmented from './Segmented.svelte';

  let {
    build,
    frame,
    frameKey,
    label,
    walls = $bindable(),
    highlight = null,
    onpick,
    preview = false,
  }: {
    /** Maillages de la scène ; null tant que le module n'a pas chargé son constructeur. */
    build: (() => MeshData[]) | null;
    frame: SceneFrame;
    /** La caméra n'est recadrée que quand cette clé change (autre scène). */
    frameKey: string;
    label: string;
    /** Mode des murs ; le choix s'affiche s'il est fourni (maillages repérés par `tagWalls`). */
    walls?: WallMode;
    /** Contour au sol en surbrillance (x, z en m). */
    highlight?: readonly [number, number][] | null;
    onpick?: (p: [number, number]) => void;
    preview?: boolean;
  } = $props();

  // deux gabarits (vue, aperçu) lient les mêmes éléments
  let box = $state<HTMLDivElement>();
  let canvas = $state<HTMLCanvasElement>();
  let scene = $state.raw<Scene3D | null>(null);
  let preset = $state<CameraPreset>('biais');
  let stats = $state<SceneStats>({ drawCalls: 0, triangles: 0, fps: 0 });
  let error = $state('');
  let spinning = $state(false);
  let framedFor = '';

  onMount(() => {
    let disposed = false,
      ro: ResizeObserver | null = null;
    void import('../../render/scene3d/scene')
      .then((sc) => {
        if (disposed) return;
        const s = new sc.Scene3D(canvas!, {
          shadowSize: matchMedia('(max-width: 700px)').matches || preview ? 1024 : 2048,
          interactive: !preview,
        });
        s.onStats = (st) => (stats = st);
        ro = new ResizeObserver(([e]) => s.setSize(e!.contentRect.width, e!.contentRect.height));
        ro.observe(box!);
        scene = s;
      })
      .catch(() => (error = 'La vue 3D n’est pas disponible sur cet appareil (WebGL désactivé).'));
    return () => {
      disposed = true;
      ro?.disconnect();
      scene?.dispose();
    };
  });

  // Données changées : nouveaux maillages ; la caméra n'est recadrée que pour une autre scène.
  $effect(() => {
    if (!scene || !build) return;
    const meshes = build();
    scene.setData(meshes, frame, frameKey !== framedFor ? preset : null);
    framedFor = frameKey;
  });

  $effect(() => scene?.setWallMode(walls ?? 'full'));
  $effect(() => scene?.setHighlight(highlight));

  /** Toucher sans glisser : le point du sol sous le doigt. */
  let down: { x: number; y: number; t: number } | null = null;
  function onpointerdown(e: PointerEvent) {
    down = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  }
  function onpointerup(e: PointerEvent) {
    const d = down;
    down = null;
    if (!d || !onpick || !scene) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || e.timeStamp - d.t > 500) return;
    const p = scene.pickGround(e.clientX, e.clientY);
    if (p) onpick(p);
  }

  function onkeydown(e: KeyboardEvent) {
    if (!scene) return;
    const k = e.key;
    if (k === 'ArrowLeft') scene.orbit(-0.15, 0);
    else if (k === 'ArrowRight') scene.orbit(0.15, 0);
    else if (k === 'ArrowUp') scene.orbit(0, 0.1);
    else if (k === 'ArrowDown') scene.orbit(0, -0.1);
    else if (k === '+' || k === '=') scene.zoom(0.85);
    else if (k === '-') scene.zoom(1.18);
    else return;
    e.preventDefault();
  }
</script>

{#if preview}
  <div class="v3d" bind:this={box} role="img" aria-label={label} data-draw-calls={stats.drawCalls}>
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
    {#if error}<p class="err">{error}</p>{/if}
  </div>
{:else}
  <div class="v3d">
    <!-- role="application" : vue manipulée directement (souris, doigts) et au clavier (flèches, +, −). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="box"
      bind:this={box}
      role="application"
      tabindex="0"
      aria-label={label}
      aria-describedby="v3d-help"
      data-fps={stats.fps}
      data-draw-calls={stats.drawCalls}
      data-triangles={stats.triangles}
      {onkeydown}
      {onpointerdown}
      {onpointerup}
    >
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
    </div>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    {#if walls}
      <div class="walls">
        <Segmented
          label="Murs"
          bind:value={walls}
          options={[
            { value: 'full', label: 'Pleins' },
            { value: 'low', label: 'Bas' },
            { value: 'cut', label: 'Coupés' },
          ]}
        />
      </div>
    {/if}
    <div class="tools">
      <Segmented
        label="Point de vue"
        bind:value={preset}
        onchange={(p) => scene?.setPreset(p)}
        options={[
          { value: 'face', label: 'Face' },
          { value: 'biais', label: 'Biais' },
          { value: 'haut', label: 'Plongée' },
        ]}
      />
      <div class="zoom">
        <button
          type="button"
          class="spin"
          aria-pressed={spinning}
          onclick={() => {
            spinning = !spinning;
            scene?.setAutoRotate(spinning);
          }}>{spinning ? 'Arrêter' : 'Faire tourner'}</button
        >
        <IconButton icon="plus" variant="outline" label="Rapprocher" onclick={() => scene?.zoom(0.85)} />
        <IconButton icon="minus" variant="outline" label="Éloigner" onclick={() => scene?.zoom(1.18)} />
      </div>
    </div>
    <p id="v3d-help" class="hint" class:low={!!walls}>
      Glisser pour tourner, pincer ou molette pour zoomer. Au clavier : flèches et + / −.
    </p>
  </div>
{/if}

<style>
  .v3d {
    position: absolute;
    inset: 0;
  }
  .box {
    position: absolute;
    inset: 0;
    touch-action: none;
  }
  .box:focus-visible {
    outline-offset: -3px;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .walls {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
  }
  .hint.low {
    top: auto;
    bottom: calc(var(--touch) + var(--space-4));
  }
  .tools {
    position: absolute;
    left: var(--space-2);
    right: var(--space-2);
    bottom: var(--space-2);
    display: flex;
    flex-wrap: wrap-reverse;
    justify-content: space-between;
    gap: var(--space-2);
    pointer-events: none;
  }
  .tools > :global(*) {
    pointer-events: auto;
  }
  .zoom {
    display: flex;
    gap: var(--space-1);
  }
  .spin {
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    font-weight: 500;
    cursor: pointer;
  }
  .spin[aria-pressed='true'] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .hint {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    max-width: 60%;
    padding: 2px var(--space-2);
    border-radius: 6px;
    background: rgb(255 255 255 / 0.8);
    color: var(--pp-charbon);
    font-size: var(--fs-xs);
    text-align: right;
    pointer-events: none;
  }
  .err {
    position: absolute;
    inset: auto var(--space-3) 50% var(--space-3);
    text-align: center;
    color: var(--thin-ink);
  }
</style>
