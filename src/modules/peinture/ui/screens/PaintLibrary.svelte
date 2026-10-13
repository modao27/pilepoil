<script lang="ts">
  /** Bibliothèque de peintures (#/library/paints). */
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { euros } from '../../../../ui/lib/format';
  import type { LibraryScreenProps } from '../../../types';
  import type { Paint } from '../../core/paint';
  import { ROLE_LABEL, SHEEN_LABEL } from '../lib/messages';

  let { nav }: LibraryScreenProps = $props();

  const paints = $derived((app.libraries.paints ?? []) as readonly Paint[]);
  const unit = (p: Paint) => (p.role === 'filler' ? 'kg' : 'L');
  const packs = (p: Paint) =>
    p.packs
      .map((k) => `${k.size.toLocaleString('fr-FR')} ${unit(p)}${k.price != null ? ' ' + euros(k.price) : ''}`)
      .join(' · ');
</script>

<Screen title="Bibliothèques" backHref="#/" backLabel="Accueil">
  {@render nav?.()}
  {#if paints.length === 0}
    <EmptyState
      icon="tiles"
      title="Aucune peinture"
      text="Ajoutez vos peintures une fois : rendement, pots et prix. Vous les choisirez ensuite dans vos projets de peinture."
    >
      {#snippet action()}<Button variant="primary" icon="plus" href="#/library/paints/new">Ajouter une peinture</Button
        >{/snippet}
    </EmptyState>
  {:else}
    <div class="top">
      <Button variant="primary" icon="plus" href="#/library/paints/new">Ajouter une peinture</Button>
    </div>
    <ul class="list" aria-label="Peintures">
      {#each paints as p (p.id)}
        <li>
          <a href="#/library/paints/{p.id}">
            <span class="swatch" style="background: {p.color?.hex ?? 'transparent'}" aria-hidden="true"></span>
            <span class="txt">
              <span class="name">{p.name}</span>
              <span class="muted">
                {ROLE_LABEL[p.role]}{p.sheen ? ' · ' + SHEEN_LABEL[p.sheen] : ''}{p.color ? ' · ' + p.color.name : ''}
                {p.role === 'filler' ? '' : ` · ${p.yield.toLocaleString('fr-FR')} m²/L, ${p.coats} couches`}
              </span>
              <span class="muted">{packs(p)}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Screen>

<style>
  .top {
    display: flex;
    margin-bottom: var(--space-4);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
    gap: var(--space-2);
  }
  a {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    min-height: var(--touch);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: var(--ink);
    text-decoration: none;
  }
  a:hover {
    border-color: var(--accent);
  }
  .swatch {
    flex: none;
    width: 40px;
    height: 40px;
    border: 1px solid var(--line);
    border-radius: 50%;
  }
  .txt {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
</style>
