<script lang="ts">
  import { ui } from '../../modules/carrelage';
  /** Démonstration du système de design : tous les composants, en clair et en sombre. */
  import BottomSheet from '../components/BottomSheet.svelte';
  import Button from '../components/Button.svelte';
  import Checkbox from '../components/Checkbox.svelte';
  import ColorSwatch from '../components/ColorSwatch.svelte';
  import DataTable from '../components/DataTable.svelte';
  import Dialog from '../components/Dialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import IconButton from '../components/IconButton.svelte';
  import ListReorder from '../components/ListReorder.svelte';
  import NumberField from '../components/NumberField.svelte';
  import PhotoPicker from '../components/PhotoPicker.svelte';
  import Screen from '../components/Screen.svelte';
  import Segmented from '../components/Segmented.svelte';
  import StatCard from '../components/StatCard.svelte';
  import Tabs from '../components/Tabs.svelte';
  import TextField from '../components/TextField.svelte';
  import { app } from '../lib/app.svelte';
  import { toast } from '../lib/toasts.svelte';
  import type { PatternId } from '../../modules/carrelage';

  let width = $state(3000);
  let joint = $state(3);
  let name = $state('Salle de bain');
  let reuse = $state(true);
  let color = $state('#d8cfc2');
  let view = $state<'plan' | 'render' | '3d'>('plan');
  let tab = $state<'tile' | 'pattern' | 'zones'>('tile');
  let dialog = $state(false);
  let snap = $state<0 | 1 | 2>(1);
  let photo = $state<string | null>(null);
  let pattern = $state<PatternId>('half');
  let zones = $state([
    { id: 'a', label: 'Zone 1 — frise, 3 rangées' },
    { id: 'b', label: 'Zone 2 — décalé ½' },
    { id: 'c', label: 'Zone 3 — reste de la surface' },
  ]);

  const rows = [
    { name: '60 × 30 cm, blanc', posed: 46, order: 51, m2: 9.18 },
    { name: 'Hexagone 20 cm, gris', posed: 120, order: 133, m2: 4.61 },
  ];
</script>

<Screen title="Système de design" backHref="#/settings" backLabel="Retour aux réglages">
  <div class="demo">
    <section>
      <h2>Couleurs</h2>
      <div class="swatches">
        {#each ['paper', 'sheet', 'ink', 'muted', 'line', 'accent', 'cut', 'reuse', 'thin'] as t (t)}
          <div class="tok"><span style="background: var(--{t})"></span><code>--{t}</code></div>
        {/each}
      </div>
      <Segmented
        label="Thème"
        value={app.theme}
        options={[
          { value: 'auto', label: 'Automatique' },
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
        ]}
        onchange={(t) => app.setTheme(t)}
      />
    </section>

    <section>
      <h2>Typographie</h2>
      <p style="font-size: var(--fs-xl)">Titre 28</p>
      <p style="font-size: var(--fs-lg)">Titre 20</p>
      <p>Texte 16 — phrases courtes, verbes d’action.</p>
      <p style="font-size: var(--fs-sm)">Texte 14</p>
      <p class="muted" style="font-size: var(--fs-xs)">Note 12</p>
      <p class="num" style="font-size: var(--fs-xl)">1 205,5 mm · 46 carreaux</p>
    </section>

    <section>
      <h2>Boutons</h2>
      <div class="row">
        <Button variant="primary" icon="plus">Nouveau projet</Button>
        <Button>Optimiser le départ</Button>
        <Button variant="ghost" icon="copy">Dupliquer</Button>
        <Button variant="danger" icon="trash">Supprimer</Button>
        <Button disabled>Indisponible</Button>
      </div>
      <div class="row">
        <IconButton icon="undo" label="Annuler" />
        <IconButton icon="redo" label="Rétablir" />
        <IconButton icon="more" label="Plus d’actions" variant="outline" />
        <IconButton icon="plus" label="Ajouter" variant="primary" />
      </div>
      <Segmented
        label="Vue"
        bind:value={view}
        options={[
          { value: 'plan', label: 'Plan' },
          { value: 'render', label: 'Rendu' },
          { value: '3d', label: '3D' },
        ]}
      />
    </section>

    <section>
      <h2>Champs</h2>
      <div class="grid">
        <NumberField
          label="Largeur de la surface"
          bind:value={width}
          unit="cm"
          factor={10}
          min={1}
          hint="Calcul accepté : 240-12"
        />
        <NumberField label="Joint" bind:value={joint} unit="mm" min={0} max={20} step={0.5} />
        <TextField label="Nom du projet" bind:value={name} />
        <Checkbox
          label="Réemployer les chutes"
          hint="Les coupes sont taillées dans les chutes quand c’est possible."
          bind:checked={reuse}
        />
      </div>
      <ColorSwatch label="Couleur du carreau" bind:value={color} palette={app.palette.tiles} />
      <PhotoPicker url={photo} onpick={(p) => (photo = URL.createObjectURL(p.blob))} onremove={() => (photo = null)} />
    </section>

    <section>
      <h2>Motifs</h2>
      {#await ui.PatternPicker() then { default: PatternPicker }}<PatternPicker bind:value={pattern} />{/await}
    </section>

    <section>
      <h2>Onglets</h2>
      <Tabs
        label="Réglages de la surface"
        bind:active={tab}
        tabs={[
          { id: 'tile', label: 'Carreau' },
          { id: 'pattern', label: 'Motif' },
          { id: 'zones', label: 'Zones' },
        ]}
      >
        {#snippet panel(id)}
          <p>Contenu de l’onglet « {id === 'tile' ? 'Carreau' : id === 'pattern' ? 'Motif' : 'Zones'} ».</p>
        {/snippet}
      </Tabs>
    </section>

    <section>
      <h2>Liste réordonnable</h2>
      <ListReorder
        label="Zones"
        items={zones}
        itemLabel={(z) => z.label}
        onmove={(from, to) => {
          const next = zones.slice();
          const [it] = next.splice(from, 1);
          next.splice(to, 0, it!);
          zones = next;
        }}
      >
        {#snippet item(z)}<span class="li">{z.label}</span>{/snippet}
      </ListReorder>
    </section>

    <section>
      <h2>Chiffres et tableau</h2>
      <div class="stats">
        <StatCard label="À commander" value="51" unit="carreaux" />
        <StatCard label="Coupes" value="14" status="cut" />
        <StatCard label="Dans les chutes" value="6" status="reuse" />
        <StatCard label="Coupes fines" value="2" status="thin" />
      </div>
      <DataTable
        caption="Commande"
        {rows}
        columns={[
          { key: 'name', label: 'Carreau', cell: (r) => r.name },
          { key: 'posed', label: 'Posés', numeric: true, cell: (r) => String(r.posed) },
          { key: 'order', label: 'À commander', numeric: true, cell: (r) => String(r.order) },
          { key: 'm2', label: 'Surface', numeric: true, cell: (r) => r.m2.toLocaleString('fr-FR') + ' m²' },
        ]}
      />
    </section>

    <section>
      <h2>Messages et dialogues</h2>
      <div class="row">
        <Button
          onclick={() => toast('Zone supprimée.', { action: { label: 'Annuler', run: () => toast('Zone rétablie.') } })}
        >
          Afficher un message
        </Button>
        <Button onclick={() => toast('Enregistrement impossible : stockage plein.', { tone: 'error' })}
          >Afficher une erreur</Button
        >
        <Button onclick={() => (dialog = true)}>Ouvrir un dialogue</Button>
      </div>
      <Dialog bind:open={dialog} title="Supprimer la zone ?">
        <p>La zone 2 et ses réglages seront retirés. Vous pourrez annuler.</p>
        {#snippet actions()}
          <Button onclick={() => (dialog = false)}>Garder</Button>
          <Button variant="danger" onclick={() => (dialog = false)}>Supprimer la zone</Button>
        {/snippet}
      </Dialog>
      <div class="sheet-box">
        <BottomSheet label="Réglages" bind:snap contained>
          {#snippet header()}<p class="sum num">46 carreaux · 0 coupe fine · 312 €</p>{/snippet}
          <p>Panneau tiré : toucher la poignée, la glisser, ou utiliser les flèches.</p>
          <p class="muted">Cran actuel : {['fermé', 'mi-hauteur', 'plein'][snap]}.</p>
        </BottomSheet>
      </div>
    </section>

    <section>
      <h2>État vide</h2>
      <EmptyState
        icon="tiles"
        title="Aucun carreau"
        text="Ajoutez vos carreaux une fois, puis réutilisez-les dans tous vos projets."
      >
        {#snippet action()}<Button variant="primary" icon="plus">Ajouter un carreau</Button>{/snippet}
      </EmptyState>
    </section>
  </div>
</Screen>

<style>
  .demo {
    display: grid;
    gap: var(--space-5);
  }
  section {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--r-panel);
    background: var(--sheet);
    border: 1px solid var(--line);
    min-width: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-3);
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: var(--space-2);
  }
  .tok {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-xs);
  }
  .tok span {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--field-border);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-2);
  }
  .li {
    display: block;
    padding: var(--space-2) 0;
  }
  .sheet-box {
    position: relative;
    height: 320px;
    overflow: hidden;
    border-radius: var(--r-panel);
    background: repeating-linear-gradient(45deg, var(--paper) 0 12px, var(--line) 12px 13px);
  }
  .sum {
    font-size: var(--fs-lg);
    font-weight: 600;
  }
</style>
