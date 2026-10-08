<script lang="ts">
  import type { Tile } from '../../state/model';
  import { app } from '../lib/app.svelte';

  let { tile, size = 48 }: { tile: Tile; size?: number } = $props();
  $effect(() => app.loadPhoto(tile.photoId));
  const url = $derived(tile.photoId ? app.photoUrls[tile.photoId] : undefined);
  const clip = $derived(
    tile.shape === 'hex'
      ? 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)'
      : tile.shape === 'octo'
        ? 'polygon(29% 0, 71% 0, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0 71%, 0 29%)'
        : 'none',
  );
</script>

<span
  class="sw"
  style="--s: {size}px; background-color: {tile.color}; {url ? `background-image: url(${url});` : ''} clip-path: {clip}"
  aria-hidden="true"
></span>

<style>
  .sw {
    flex: none;
    display: block;
    width: var(--s);
    height: var(--s);
    border-radius: 6px;
    border: 1px solid var(--line);
    background-size: cover;
    background-position: center;
  }
</style>
