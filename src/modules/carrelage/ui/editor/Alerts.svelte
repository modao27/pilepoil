<script lang="ts">
  /** Alertes de la surface : ce qui ne va pas, et le bouton qui le corrige. */
  import { warningText, errorText } from '../lib/messages';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { EditorState, Tab } from './editorState.svelte';

  let { ed, onsurface }: { ed: EditorState; onsurface: () => void } = $props();

  type Alert = { text: string; action?: { label: string; run: () => void }; tone: 'error' | 'warn' };

  const goTab = (t: Tab) => () => (ed.tab = t);
  const lastToRest = () => ed.updateZone({ unit: 'rest' }, undefined, ed.surface.zones.length - 1);

  const alerts = $derived.by<Alert[]>(() => {
    const r = ed.surfaceResult;
    if (!r) return [];
    if (!r.ok) {
      const e = r.error;
      return [
        {
          tone: 'error',
          text: errorText(e),
          action:
            e.code === 'invalid-surface'
              ? { label: 'Régler la surface', run: onsurface }
              : { label: 'Choisir un carreau', run: goTab('tile') },
        },
      ];
    }
    const out: Alert[] = [];
    const pieces = r.value.pieces;
    const thin = pieces.filter((p) => p.thin).length,
      vis = pieces.filter((p) => p.vis.length).length;
    if (thin)
      out.push({
        tone: 'warn',
        text: `${thin} coupe${thin > 1 ? 's' : ''} fine${thin > 1 ? 's' : ''} sur cette surface.`,
        action: ed.optimizing
          ? undefined
          : {
              label: 'Optimiser',
              run: () =>
                ed.optimize(
                  ed.surface.zones.map((_, i) => i),
                  'thin',
                ),
            },
      });
    if (vis)
      out.push({
        tone: 'warn',
        text: `${vis} coupe${vis > 1 ? 's' : ''} apparente${vis > 1 ? 's' : ''} sur un bord visible.`,
        action: { label: 'Bords cachés', run: goTab('finish') },
      });
    for (const w of r.value.warnings) {
      const text = warningText(w, ed.surface);
      if (w.code === 'zones-gap' || w.code === 'zones-overflow')
        out.push({ tone: 'warn', text, action: { label: 'Ajuster la dernière zone', run: lastToRest } });
      else if (w.code === 'reveal-pattern')
        out.push({ tone: 'warn', text, action: { label: 'Ouvertures', run: goTab('openings') } });
      else if (w.code === 'plinth-too-high') {
        const t = app.tile(ed.zone.tileId);
        out.push({
          tone: 'warn',
          text,
          action: t
            ? {
                label: 'Adapter la hauteur',
                run: () => ed.updateSurface({ plinth: { ...ed.surface.plinth!, height: t.width } }),
              }
            : undefined,
        });
      } else out.push({ tone: 'warn', text, action: { label: 'Plinthes', run: goTab('finish') } });
    }
    return out;
  });
</script>

{#if alerts.length}
  <ul class="alerts" aria-label="Alertes">
    {#each alerts as a, i (i)}
      <li class={a.tone}>
        <span>{a.text}</span>
        {#if a.action}<button type="button" onclick={a.action.run}>{a.action.label}</button>{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .alerts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding-left: var(--space-3);
    border-radius: var(--r-field);
    background: var(--thin-soft);
    border-left: 4px solid var(--thin);
    font-size: var(--fs-sm);
  }
  li.warn {
    background: var(--paper);
    border-left-color: var(--cut);
  }
  span {
    padding: var(--space-2) 0;
  }
  button {
    flex: none;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 0;
    background: transparent;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }
</style>
