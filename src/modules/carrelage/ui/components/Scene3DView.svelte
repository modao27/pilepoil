<script lang="ts">
  /**
   * Vue 3D (three.js chargé à la demande). Glisser pour tourner, pincer ou molette pour zoomer,
   * deux doigts pour déplacer. Clavier : flèches pour tourner, + / − pour zoomer.
   */
  import { onMount } from 'svelte';
  import type { ProjectResult, ProjectSpec } from '../../core';
  import type { CameraPreset, SceneLayout } from '../../render/scene3d/placement';
  import type { Scene3D, SceneStats } from '../../render/scene3d/scene';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';

  let {
    spec,
    result,
    layout,
    shade,
    photo,
    label,
  }: {
    spec: ProjectSpec;
    result: ProjectResult;
    layout: SceneLayout;
    shade: number;
    photo: (surface: number, zone: number) => { url: string; flip: boolean } | null;
    label: string;
  } = $props();

  let box: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let scene = $state.raw<Scene3D | null>(null);
  let build = $state.raw<typeof import('../../render/scene3d/meshes').buildMeshes | null>(null);
  let preset = $state<CameraPreset>('biais');
  let stats = $state<SceneStats>({ drawCalls: 0, triangles: 0, fps: 0 });
  let error = $state('');
  let spinning = $state(false);
  let framedFor = '';

  onMount(() => {
    let disposed = false,
      ro: ResizeObserver | null = null;
    void Promise.all([import('../../render/scene3d/scene'), import('../../render/scene3d/meshes')])
      .then(([sc, me]) => {
        if (disposed) return;
        const s = new sc.Scene3D(canvas, { shadowSize: matchMedia('(max-width: 700px)').matches ? 1024 : 2048 });
        s.onStats = (st) => (stats = st);
        ro = new ResizeObserver(([e]) => s.setSize(e!.contentRect.width, e!.contentRect.height));
        ro.observe(box);
        build = me.buildMeshes;
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
    const meshes = build({ spec, result, layout, shade, photo });
    const key = layout.instances.map((i) => i.surface).join(',') + (layout.room ? 'room' : '');
    scene.setData(meshes, layout, key !== framedFor ? preset : null);
    framedFor = key;
  });

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
  >
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  </div>
  {#if error}<p class="err" role="alert">{error}</p>{/if}
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
  <p id="v3d-help" class="hint">Glisser pour tourner, pincer ou molette pour zoomer. Au clavier : flèches et + / −.</p>
</div>

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
  .tools {
    position: absolute;
    left: var(--space-2);
    right: var(--space-2);
    bottom: var(--space-2);
    display: flex;
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
    color: #2a3640;
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
