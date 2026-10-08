<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '../icons/Icon.svelte';

  let { icon, title, text, action }: { icon: IconName; title: string; text: string; action?: Snippet } = $props();
</script>

<div class="empty">
  <span class="ic"><Icon name={icon} size={40} /></span>
  <h2>{title}</h2>
  <p class="muted">{text}</p>
  {#if action}<div class="act">{@render action()}</div>{/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }
  .ic {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
  }
  p {
    max-width: 36ch;
  }
  .act {
    margin-top: var(--space-2);
  }
</style>
