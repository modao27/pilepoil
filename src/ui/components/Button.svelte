<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon, { type IconName } from '../icons/Icon.svelte';

  type Props = HTMLButtonAttributes & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    icon?: IconName;
    /** Lien stylé en bouton (navigation). */
    href?: string;
    block?: boolean;
    children: Snippet;
  };
  let { variant = 'secondary', icon, href, block = false, children, type = 'button', ...rest }: Props = $props();
</script>

{#if href}
  <a class="btn {variant}" class:block {href}>
    {#if icon}<Icon name={icon} size={20} />{/if}
    <span>{@render children()}</span>
  </a>
{:else}
  <button class="btn {variant}" class:block {type} {...rest}>
    {#if icon}<Icon name={icon} size={20} />{/if}
    <span>{@render children()}</span>
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--touch);
    padding: 0 var(--space-4);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    font-weight: 500;
    font-size: var(--fs-md);
    text-decoration: none;
    cursor: pointer;
    transition:
      background var(--dur),
      border-color var(--dur);
    -webkit-tap-highlight-color: transparent;
  }
  .btn:hover {
    border-color: var(--ink);
  }
  .block {
    display: flex;
    width: 100%;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .primary:hover {
    border-color: var(--accent);
    filter: brightness(1.08);
  }
  .ghost {
    background: transparent;
    border-color: transparent;
  }
  .ghost:hover {
    background: var(--accent-soft);
    border-color: transparent;
  }
  .danger {
    color: var(--thin-ink);
    border-color: var(--thin);
  }
  .danger:hover {
    background: var(--thin-soft);
    border-color: var(--thin);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: none;
  }
</style>
