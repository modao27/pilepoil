<script lang="ts">
  /** Éditeur du plan commun (#/p/:id/plan) : plan au centre, réglages dans le panneau (téléphone) ou à droite. */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../state/model';
  import BottomSheet from '../components/BottomSheet.svelte';
  import IconButton from '../components/IconButton.svelte';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import TextField from '../components/TextField.svelte';
  import { moduleById } from '../../modules/registry';
  import { formatNumber } from '../lib/calc';
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';
  import AddRoomDialog from './AddRoomDialog.svelte';
  import PlanCanvas from './PlanCanvas.svelte';
  import PlanPanel from './PlanPanel.svelte';
  import { PlanEditorState } from './planState.svelte';

  /** `isNew` : projet pas encore enregistré (#/new), créé avec sa première pièce. */
  let { project, isNew = false }: { project: Project; isNew?: boolean } = $props();

  const st = untrack(() => new PlanEditorState(project, { isNew }));
  let renaming = $state(false);
  let renameError = $state('');
  let newName = $state('');
  let roomName = $state('');

  // projet neuf : enregistré dès sa première pièce, puis l'adresse devient celle de son plan (même éditeur)
  $effect(() => {
    if (!st.isNew || !st.plan.rooms.length) return;
    st.isNew = false;
    void st.flush().then(() => go({ name: 'plan', id: st.doc.id }, true));
  });

  // contour fermé : nom proposé pour la pièce
  $effect(() => {
    if (st.naming) untrack(() => (roomName = st.nextRoomName()));
  });

  function rename() {
    const n = newName.trim();
    if (!n) {
      renameError = 'Le nom ne peut pas être vide.';
      return;
    }
    renameError = '';
    st.dispatch({ type: 'project/rename', name: n });
    renaming = false;
    // enregistré tout de suite : un nom ne doit pas attendre
    void st.flush();
  }
  let desktop = $state(false);
  let snap = $state<0 | 1 | 2>(1);
  let adding = $state(false);
  let canvas: PlanCanvas;

  // projet modifié ailleurs (autre onglet, autre écran) : on reprend la version enregistrée la plus récente
  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => st.doc);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) st.store.reset(ext);
  });

  // ouverture d'un panneau utile dès qu'on choisit un élément
  $effect(() => {
    if (st.sel || st.mode !== 'select') untrack(() => snap === 0 && (snap = 1));
  });

  const rooms = $derived(st.plan.rooms.length);
  const label = $derived(
    `Plan de ${st.doc.name} : ${rooms} pièce${rooms > 1 ? 's' : ''}` +
      (st.mode === 'draw'
        ? ', dessin en cours'
        : st.mode === 'link'
          ? ', choix de la porte à relier'
          : st.mode === 'partition'
            ? ', tracé d’une cloison'
            : st.mode === 'demolish'
              ? ', choix du mur à démolir'
              : '') +
      (st.layer === 'works' ? ', calque travaux' : ''),
  );

  onMount(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const upd = () => (desktop = mq.matches);
    upd();
    mq.addEventListener('change', upd);
    const flush = () => void st.flush();
    window.addEventListener('pagehide', flush);
    // page mise en arrière-plan (changement d'application sur téléphone) : pagehide n'est pas toujours émis
    const hide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', hide);
    // mêmes raccourcis que le calepinage : Ctrl+Z annule, Ctrl+Y ou Ctrl+Maj+Z rétablit
    const keys = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) st.undo();
      else if (k === 'y' || (k === 'z' && e.shiftKey)) st.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', keys);
    if (!st.plan.rooms.length) adding = true;
    return () => {
      window.removeEventListener('keydown', keys);
      mq.removeEventListener('change', upd);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hide);
      flush();
    };
  });
</script>

{#snippet panel()}
  <PlanPanel {st} onaddroom={() => (adding = true)} />
{/snippet}

<div class="editor" class:desktop>
  <header class="bar">
    {#if st.isNew}
      <IconButton icon="back" label="Accueil" href="#/" />
    {:else}
      <IconButton icon="back" label="Projet" href="#/p/{st.doc.id}" />
    {/if}
    <h1>
      <span class="pname">{st.doc.name}</span><span class="sub"
        >{st.layer === 'works' ? 'Plan : travaux' : 'Plan des pièces'}</span
      >
    </h1>
    <IconButton
      icon="edit"
      label="Renommer le projet"
      onclick={() => ((newName = st.doc.name), (renameError = ''), (renaming = true))}
    />
    <IconButton icon="undo" label="Annuler" disabled={!st.canUndo} onclick={() => st.undo()} />
    <IconButton icon="redo" label="Rétablir" disabled={!st.canRedo} onclick={() => st.redo()} />
    <IconButton icon="plus" label="Ajouter une pièce" onclick={() => (adding = true)} />
  </header>

  <main class="body">
    <div class="planwrap" style={desktop ? '' : `bottom: ${snap === 0 ? '96px' : '50%'}`}>
      <PlanCanvas bind:this={canvas} {st} {label} />
      <div class="float">
        <IconButton icon="fit" label="Voir tout le plan" onclick={() => canvas.fit()} />
      </div>
    </div>
    {#if desktop}
      <aside class="inspector" aria-label="Réglages du plan">{@render panel()}</aside>
    {:else}
      <BottomSheet label="Réglages du plan" bind:snap contained peek={96}>
        {#snippet header()}
          <p class="peek">
            {st.mode === 'draw'
              ? 'Dessin : touchez pour placer un coin'
              : st.mode === 'link'
                ? 'Touchez la porte à relier'
                : st.mode === 'partition'
                  ? st.partitionFrom
                    ? 'Cloison : touchez le point d’arrivée'
                    : 'Cloison : touchez le point de départ'
                  : st.mode === 'demolish'
                    ? 'Touchez le mur à démolir'
                    : st.layer === 'works'
                      ? 'Travaux'
                      : `${rooms} pièce${rooms > 1 ? 's' : ''}`}
          </p>
        {/snippet}
        {@render panel()}
      </BottomSheet>
    {/if}
  </main>
</div>

<AddRoomDialog {st} bind:open={adding} />

<Dialog bind:open={renaming} title="Renommer le projet">
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      rename();
    }}
  >
    <TextField label="Nom du projet" bind:value={newName} maxlength={60} error={renameError} />
  </form>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (renaming = false)}>Annuler</Button>
    <Button variant="primary" onclick={rename}>Renommer</Button>
  {/snippet}
</Dialog>

<Dialog open={st.pending != null} title="Des revêtements seront réduits" onclose={() => st.cancelPending()}>
  {#if st.pending}
    <p>Ce changement retire de la surface revêtue :</p>
    <ul class="loss">
      {#each st.pending.loss as l (l.pose.id)}
        <li>
          {moduleById(l.pose.module)?.label ?? l.pose.module}, « {l.pose.name} » : −{formatNumber(l.area / 1e6, 2)} m²
        </li>
      {/each}
    </ul>
    <p class="muted">
      Rien n’est supprimé : les revêtements reviennent si vous retirez la cloison ou la démolition, ou si vous annulez.
    </p>
  {/if}
  {#snippet actions()}
    <Button onclick={() => st.cancelPending()}>Annuler</Button>
    <Button variant="primary" onclick={() => st.confirmPending()}>Valider</Button>
  {/snippet}
</Dialog>

<Dialog
  open={st.namingNew != null}
  title={st.namingNew && st.namingNew.length > 1 ? 'Nommer les nouvelles pièces' : 'Nommer la nouvelle pièce'}
  onclose={() => (st.namingNew = null)}
>
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      st.nameNewRooms();
    }}
  >
    <p class="muted">
      La cloison a séparé la pièce en deux. Ce nom se retrouve dans les résultats, les PDF et les achats.
    </p>
    {#each st.namingNew ?? [] as r (r.id)}
      <TextField label="Nom de la pièce" bind:value={r.name} maxlength={40} />
    {/each}
  </form>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (st.namingNew = null)}>Garder les noms proposés</Button>
    <Button variant="primary" onclick={() => st.nameNewRooms()}>Valider</Button>
  {/snippet}
</Dialog>

<Dialog open={st.naming} title="Nommer la pièce" onclose={() => (st.naming = false)}>
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      st.finishDraw(roomName);
    }}
  >
    <TextField label="Nom de la pièce" bind:value={roomName} maxlength={40} />
  </form>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (st.naming = false)}>Retour au dessin</Button>
    <Button variant="primary" onclick={() => st.finishDraw(roomName)}>Créer la pièce</Button>
  {/snippet}
</Dialog>

<style>
  .editor {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100dvh;
    background: var(--paper);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 56px;
    padding: env(safe-area-inset-top) 6px 0;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
  }
  h1 {
    flex: 1;
    min-width: 0;
    display: grid;
    margin: 0 var(--space-2);
    font-size: var(--fs-md);
  }
  .pname {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: var(--fs-sm);
    font-weight: 400;
    color: var(--muted);
  }
  .body {
    position: relative;
    min-height: 0;
  }
  .planwrap {
    position: absolute;
    inset: 0;
  }
  .float {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    border-radius: var(--r-field);
    background: var(--paper);
  }
  .loss {
    margin: 0;
    padding-left: var(--space-5);
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .peek {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    margin: 0;
    font-weight: 600;
  }
  .desktop .body {
    display: grid;
    grid-template-columns: 1fr 400px;
  }
  .desktop .planwrap {
    position: relative;
  }
  .desktop .inspector {
    overflow: auto;
    padding: var(--space-3) var(--space-4) var(--space-6);
    border-left: 1px solid var(--line);
    background: var(--sheet);
  }
</style>
