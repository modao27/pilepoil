<script lang="ts">
  /** Vue 3D du parquet : sol, lames, murs bas et plinthes, dans la vue 3D partagée (three.js à la demande). */
  import { onMount } from 'svelte';
  import type { SceneFrame } from '../../../../render/scene3d/types';
  import Scene3DView from '../../../../ui/components/Scene3DView.svelte';
  import type { ParquetResult, ParquetSpec } from '../../core/types';
  import type { ParquetLook } from '../../render/meshes';

  let {
    spec,
    result,
    looks,
    label,
  }: { spec: ParquetSpec; result: ParquetResult; looks: Record<string, ParquetLook>; label: string } = $props();

  let mod = $state.raw<typeof import('../../render/meshes') | null>(null);
  onMount(() => {
    void import('../../render/meshes').then((m) => (mod = m)).catch(() => {});
  });
  const build = $derived.by(() => {
    const m = mod;
    if (!m) return null;
    const input = { spec, result, looks };
    return () => m.buildParquetMeshes(input);
  });
  const frame = $derived<SceneFrame>(
    mod ? mod.parquetFrame(spec) : { kind: 'room', bounds: { x: [0, 1], z: [0, 1], h: 0.3 } },
  );
  const frameKey = $derived(spec.layouts.flatMap((l) => l.rooms.map((r) => r.id)).join(','));
</script>

<Scene3DView {build} {frame} {frameKey} {label} />
