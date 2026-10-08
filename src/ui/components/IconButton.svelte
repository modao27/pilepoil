<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon, { type IconName } from '../icons/Icon.svelte';

  type Props = HTMLButtonAttributes & {
    icon: IconName;
    /** Nom accessible (obligatoire : le bouton n'a pas de texte). */
    label: string;
    href?: string;
    variant?: 'ghost' | 'outline' | 'primary';
  };
  let { icon, label, href, variant = 'ghost', type = 'button', ...rest }: Props = $props();
</script>

{#if href}
  <a class="ib {variant}" {href} aria-label={label} title={label}><Icon name={icon} /></a>
{:else}
  <button class="ib {variant}" {type} aria-label={label} title={label} {...rest}><Icon name={icon} /></button>
{/if}

<style>
  .ib {
    display: inline-grid;
    place-items: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--r-field);
    background: transparent;
    color: var(--ink);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ib:hover {
    background: var(--accent-soft);
  }
  .outline {
    border-color: var(--field-border);
    background: var(--sheet);
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .primary:hover {
    background: var(--accent);
    filter: brightness(1.08);
  }
  .ib:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: transparent;
  }
</style>
