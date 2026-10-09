<script lang="ts">
  /** Achats du projet (#/p/:id/achats) : lignes de tous les outils par rayon, prix modifiables, totaux, exports. */
  import type { ShoppingLine } from '../../core/shopping/types';
  import { moduleById } from '../../modules/registry';
  import type { Project } from '../../state/model';
  import { reduceProject } from '../../state/project';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
  import { euros } from '../lib/format';
  import { projectOutputs } from '../lib/moduleOutputs';
  import { consolidate, GROUP_LABEL, lineCost, parsePrice, PRICE_LABEL, toCsv } from '../lib/shopping';
  import { toast } from '../lib/toasts.svelte';

  let { id }: { id: string } = $props();

  const project = $derived(app.project(id));
  let lines = $state.raw<ShoppingLine[] | null>(null);
  $effect(() => {
    const p = project;
    void app.libraries;
    if (!p) return;
    let live = true;
    void projectOutputs(p).then((o) => live && (lines = o.flatMap((x) => x.lines)));
    return () => (live = false);
  });

  const c = $derived(lines ? consolidate(lines) : null);
  const label = (m: string) => moduleById(m)?.label ?? m;
  const several = $derived((c?.byModule.length ?? 0) > 1);
  const priceText = (v: number) => String(v).replace('.', ',');

  async function setPrice(l: ShoppingLine, text: string) {
    const p = project;
    const m = moduleById(l.module);
    if (!p || !m) return;
    const value = parsePrice(text);
    const next = reduceProject(p, m.priceAction(l.key, value));
    if (next === p) return;
    const after = { ...next, updatedAt: Date.now() };
    if (!(await app.trySaveProject(after))) return;
    toast(value == null ? `Prix de « ${l.label} » effacé.` : `Prix de « ${l.label} » enregistré.`, {
      action: { label: 'Annuler', run: () => void app.restoreIfUnchanged(after, p) },
    });
  }

  const fileBase = (p: Project) =>
    'achats-' +
    (p.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'projet');

  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportCsv() {
    if (!c || !project) return;
    save(new Blob([toCsv(c, label)], { type: 'text/csv;charset=utf-8' }), fileBase(project) + '.csv');
    toast('Tableau enregistré dans vos téléchargements.');
  }

  async function exportPdf() {
    if (!c || !project) return;
    try {
      const { shoppingPdf } = await import('../lib/shoppingPdf');
      save(shoppingPdf(c, project.name, Date.now(), label), fileBase(project) + '.pdf');
      toast('PDF enregistré dans vos téléchargements.');
    } catch {
      toast('Création du PDF impossible. Réessayez.', { tone: 'error' });
    }
  }
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé." />
  </Screen>
{:else}
  <Screen title="Achats — {project.name}" backHref="#/p/{project.id}" backLabel="Projet" wide>
    {#if !c}
      <p class="muted" role="status">Calcul de la liste…</p>
    {:else if !c.groups.length}
      <EmptyState
        icon="list"
        title="Rien à acheter pour l’instant"
        text="Ajoutez un outil au projet et complétez-le."
      />
    {:else}
      <div class="actions">
        <Button icon="download" onclick={exportPdf}>Exporter en PDF</Button>
        <Button icon="download" onclick={exportCsv}>Exporter pour un tableur</Button>
      </div>
      {#each c.groups as g (g.group)}
        <section aria-labelledby="g-{g.group}">
          <h2 id="g-{g.group}">{GROUP_LABEL[g.group]}</h2>
          <ul class="lines">
            {#each g.lines as l (l.module + l.key)}
              {@const cost = lineCost(l)}
              <li class="line">
                <div class="what">
                  <span class="label"
                    >{#if l.color}<span class="dot" style="background: {l.color}"></span>{/if}{l.label}</span
                  >
                  <span class="muted">{several ? label(l.module) + ' · ' : ''}{l.detail ?? ''}</span>
                </div>
                <label class="price">
                  <span class="sr">Prix {l.label} en {PRICE_LABEL[l.unit]}</span>
                  <input
                    type="text"
                    inputmode="decimal"
                    value={l.unitPrice != null && !l.priceFromLibrary ? priceText(l.unitPrice) : ''}
                    placeholder={l.unitPrice != null && l.priceFromLibrary ? priceText(l.unitPrice) : 'prix'}
                    onchange={(e) => setPrice(l, e.currentTarget.value)}
                  />
                  <span class="u">{PRICE_LABEL[l.unit]}</span>
                </label>
                <span class="cost num">{cost != null ? euros(cost) : '–'}</span>
              </li>
            {/each}
          </ul>
          <p class="sub num">Sous-total {GROUP_LABEL[g.group].toLowerCase()} : {euros(g.total)}</p>
        </section>
      {/each}
      <section class="totals" aria-label="Totaux">
        {#if several}
          {#each c.byModule as m (m.module)}
            <p class="num">{label(m.module)} : {euros(m.total)}</p>
          {/each}
        {/if}
        <p class="total num">Total estimé : {euros(c.total)}</p>
        {#if c.unpriced}
          <p class="muted">
            {c.unpriced} article{c.unpriced > 1 ? 's' : ''} sans prix, non compté{c.unpriced > 1 ? 's' : ''}. Saisissez
            un prix pour l’ajouter au total.
          </p>
        {/if}
        <p class="muted">
          Quantités arrondies au conditionnement, marge de casse incluse. Un prix grisé vient de la bibliothèque ;
          saisissez un prix pour le remplacer dans ce projet, effacez-le pour y revenir.
        </p>
      </section>
    {/if}
  </Screen>
{/if}

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  section {
    margin-bottom: var(--space-5);
  }
  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--fs-lg);
  }
  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
  }
  .line {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2) var(--space-3);
    align-items: center;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--line);
  }
  .what {
    grid-column: 1 / -1;
    display: grid;
    gap: 2px;
  }
  @media (min-width: 720px) {
    .line {
      grid-template-columns: 1fr auto 110px;
    }
    .what {
      grid-column: auto;
    }
  }
  .label {
    font-weight: 600;
  }
  .dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-right: 6px;
    border: 1px solid var(--line);
    border-radius: 50%;
    vertical-align: -1px;
  }
  .price {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .price input {
    width: 96px;
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    font: inherit;
    text-align: right;
  }
  .u {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
  .cost {
    text-align: right;
    font-weight: 600;
  }
  .sub {
    margin: var(--space-2) 0 0;
    text-align: right;
    color: var(--muted);
  }
  .totals p {
    margin: 0 0 var(--space-2);
  }
  .total {
    font-size: var(--fs-xl);
    font-weight: 700;
  }
  .muted {
    color: var(--muted);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
