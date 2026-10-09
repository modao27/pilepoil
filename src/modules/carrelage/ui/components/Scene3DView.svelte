<script lang="ts">
  /** Vue 3D du carrelage : maillages des murs dépliés et des carreaux, dans la vue 3D partagée. */
  import { onMount } from 'svelte';
  import Scene3DView from '../../../../ui/components/Scene3DView.svelte';
  import type { ProjectResult, ProjectSpec } from '../../core';
  import { frameOf, type SceneLayout } from '../../render/scene3d/placement';

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

  let builder = $state.raw<typeof import('../../render/scene3d/meshes').buildMeshes | null>(null);
  onMount(() => {
    void import('../../render/scene3d/meshes').then((me) => (builder = me.buildMeshes)).catch(() => {});
  });
  const build = $derived.by(() => {
    const b = builder;
    if (!b) return null;
    const input = { spec, result, layout, shade, photo };
    return () => b(input);
  });
  const frameKey = $derived(layout.instances.map((i) => i.surface).join(',') + (layout.room ? 'room' : ''));
</script>

<Scene3DView {build} frame={frameOf(layout)} {frameKey} {label} />
