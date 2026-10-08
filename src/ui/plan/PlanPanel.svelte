<script lang="ts">
  /** Réglages de l'élément choisi sur le plan ; sans sélection, liste des pièces et problèmes à corriger. */
  import type { Obstacle, PlanRoom, WallOpening } from '../../core/plan/types';
  import { wallIndex, wallLength } from '../../core/plan/walls';
  import Button from '../components/Button.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Select from '../components/Select.svelte';
  import TextField from '../components/TextField.svelte';
  import { formatNumber } from '../lib/calc';
  import { PLAN_MESSAGES } from '../lib/planMessages';
  import type { OpeningKind, PlanEditorState } from './planState.svelte';

  let { st, onaddroom }: { st: PlanEditorState; onaddroom: () => void } = $props();

  const KINDS: { value: OpeningKind; label: string }[] = [
    { value: 'door', label: 'Porte' },
    { value: 'french-window', label: 'Baie' },
    { value: 'window', label: 'Fenêtre' },
  ];
  const OBSTACLES = [
    { value: 'post' as const, label: 'Poteau' },
    { value: 'island' as const, label: 'Îlot' },
    { value: 'duct' as const, label: 'Conduit' },
    { value: 'other' as const, label: 'Autre' },
  ];
  const cm = (mm: number) => formatNumber(mm / 10, 1) + ' cm';
  const kindLabel = (k: OpeningKind) => KINDS.find((x) => x.value === k)!.label;
  /** Portes des autres pièces, pour relier la porte choisie (mode liaison). */
  const candidates = $derived(
    st.mode === 'link'
      ? st.plan.rooms
          .filter((r) => r.id !== st.linkFrom?.room)
          .flatMap((r) => r.openings.filter((o) => o.kind !== 'window').map((opening) => ({ room: r, opening })))
      : [],
  );

  const sel = $derived(st.sel);
  const room = $derived(st.selectedRoom);
  const wall = $derived(sel?.kind === 'wall' && room ? room.walls.find((w) => w.id === sel.wall) : undefined);
  const wallI = $derived(wall && room ? wallIndex(room, wall.id) : -1);
  const opening = $derived(
    sel?.kind === 'opening' && room ? room.openings.find((o) => o.id === sel.opening) : undefined,
  );
  const obstacle = $derived(
    sel?.kind === 'obstacle' && room ? room.obstacles.find((o) => o.id === sel.obstacle) : undefined,
  );
  const passage = $derived(sel?.kind === 'passage' ? st.plan.passages.find((p) => p.id === sel.passage) : undefined);
  const box = (pts: [number, number][]) => {
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };

  function updateOpening(patch: Partial<Omit<WallOpening, 'id'>>, key?: string) {
    if (room && opening)
      st.dispatch({ type: 'plan/opening/update', roomId: room.id, openingId: opening.id, patch }, key);
  }
</script>

{#snippet back(r: PlanRoom)}
  <Button variant="ghost" icon="back" onclick={() => st.select({ kind: 'room', room: r.id })}>Retour à {r.name}</Button>
{/snippet}

{#snippet items(openings: WallOpening[], obstacles: Obstacle[])}
  {#if room && (openings.length || obstacles.length)}
    <h3>Ouvertures et obstacles</h3>
    <ul class="rooms">
      {#each openings as o (o.id)}
        <li>
          <Button block onclick={() => st.select({ kind: 'opening', room: room.id, opening: o.id })}
            >{kindLabel(o.kind)}, mur {wallIndex(room, o.wall) + 1} ({cm(o.width)})</Button
          >
        </li>
      {/each}
      {#each obstacles as o (o.id)}
        <li>
          <Button block onclick={() => st.select({ kind: 'obstacle', room: room.id, obstacle: o.id })}
            >{OBSTACLES.find((x) => x.value === o.kind)?.label}</Button
          >
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<div class="panel">
  {#if st.mode === 'draw'}
    <h2>Dessiner une pièce</h2>
    <p class="muted">
      Touchez le plan pour placer chaque coin. Touchez le premier point pour fermer la pièce. Les points s’alignent sur
      les angles droits et sur une grille de 1 cm.
    </p>
    <p class="num">{st.draft.length} point{st.draft.length > 1 ? 's' : ''}</p>
    <div class="row">
      <Button variant="primary" disabled={st.draft.length < 3} onclick={() => st.finishDraw()}>Terminer la pièce</Button
      >
      <Button icon="undo" disabled={!st.draft.length} onclick={() => st.undoDrawPoint()}
        >Retirer le dernier point</Button
      >
      <Button variant="ghost" onclick={() => st.cancelDraw()}>Annuler le dessin</Button>
    </div>
  {:else if st.mode === 'link'}
    <h2>Relier à une autre porte</h2>
    <p class="muted">
      Touchez une porte d’une autre pièce, sur un mur parallèle. La pièce sera placée pour que les deux portes se
      fassent face, de part et d’autre du mur.
    </p>
    {#if candidates.length}
      <ul class="rooms" aria-label="Portes des autres pièces">
        {#each candidates as c (c.opening.id)}
          <li>
            <Button block onclick={() => st.link({ room: c.room.id, opening: c.opening.id })}
              >{kindLabel(c.opening.kind)} de {c.room.name}, mur {wallIndex(c.room, c.opening.wall) + 1}</Button
            >
          </li>
        {/each}
      </ul>
    {:else}
      <p>Aucune porte dans les autres pièces : ajoutez-en une sur un mur.</p>
    {/if}
    <Button variant="ghost" onclick={() => st.cancelLink()}>Annuler</Button>
  {:else if passage}
    {@const a = st.room(passage.a.room)}
    {@const b = st.room(passage.b.room)}
    <Button variant="ghost" icon="back" onclick={() => st.select(null)}>Toutes les pièces</Button>
    <h2>Passage</h2>
    <p>Entre {a?.name ?? '?'} et {b?.name ?? '?'}.</p>
    <Button
      variant="danger"
      icon="trash"
      onclick={() => st.dispatch({ type: 'plan/passage/remove', passageId: passage.id })}>Supprimer le passage</Button
    >
  {:else if room && opening}
    {@const len = wallLength(room, wallIndex(room, opening.wall))}
    {@render back(room)}
    <h2>{KINDS.find((k) => k.value === opening.kind)?.label} — {room.name}</h2>
    <Segmented
      label="Type d’ouverture"
      value={opening.kind}
      options={KINDS}
      onchange={(kind) => updateOpening({ kind, sill: kind === 'window' ? Math.max(opening.sill, 900) : 0 })}
    />
    <NumberField
      label="Largeur"
      unit="cm"
      factor={10}
      min={10}
      max={len / 10}
      value={opening.width}
      onchange={(width) => updateOpening({ width, offset: Math.min(opening.offset, Math.max(0, len - width)) })}
    />
    <NumberField
      label="Distance au début du mur"
      unit="cm"
      factor={10}
      min={0}
      max={Math.max(0, len - opening.width) / 10}
      value={opening.offset}
      hint="Ou glissez l’ouverture le long du mur."
      onchange={(offset) => updateOpening({ offset })}
    />
    <NumberField
      label="Hauteur"
      unit="cm"
      factor={10}
      min={10}
      value={opening.height}
      onchange={(height) => updateOpening({ height })}
    />
    {#if opening.kind === 'window'}
      <NumberField
        label="Allège"
        unit="cm"
        factor={10}
        min={0}
        value={opening.sill}
        onchange={(sill) => updateOpening({ sill })}
      />
    {/if}
    <div class="row">
      {#if opening.kind !== 'window'}
        <Button onclick={() => st.startLink({ room: room.id, opening: opening.id })}>Relier à une autre porte</Button>
      {/if}
      <Button variant="danger" icon="trash" onclick={() => st.removeOpening(room.id, opening.id)}>Supprimer</Button>
    </div>
  {:else if room && obstacle}
    {@const b = box(obstacle.outline)}
    {@render back(room)}
    <h2>Obstacle — {room.name}</h2>
    <Select
      label="Type"
      value={obstacle.kind}
      options={OBSTACLES}
      onchange={(kind) =>
        st.dispatch({ type: 'plan/obstacle/update', roomId: room.id, obstacleId: obstacle.id, patch: { kind } })}
    />
    <NumberField
      label="Largeur"
      unit="cm"
      factor={10}
      min={1}
      value={b.w}
      onchange={(w) => st.resizeObstacle(room.id, obstacle, w, b.h)}
    />
    <NumberField
      label="Profondeur"
      unit="cm"
      factor={10}
      min={1}
      value={b.h}
      onchange={(h) => st.resizeObstacle(room.id, obstacle, b.w, h)}
    />
    <p class="muted">Glissez l’obstacle pour le placer.</p>
    <Button
      variant="danger"
      icon="trash"
      onclick={() => {
        st.dispatch({ type: 'plan/obstacle/remove', roomId: room.id, obstacleId: obstacle.id });
        st.select({ kind: 'room', room: room.id });
      }}>Supprimer l’obstacle</Button
    >
  {:else if room && wall}
    {@render back(room)}
    <h2>Mur {wallI + 1} — {room.name}</h2>
    <NumberField
      label="Longueur"
      unit="cm"
      factor={10}
      min={1}
      value={wallLength(room, wallI)}
      hint="Les murs suivants se déplacent pour garder les angles."
      onchange={(length) => st.dispatch({ type: 'plan/wall/length', roomId: room.id, wallId: wall.id, length })}
    />
    <NumberField
      label="Épaisseur"
      unit="cm"
      factor={10}
      min={0.1}
      value={wall.thickness}
      hint="Cloison placo 72/48 : 7,2 cm."
      onchange={(thickness) =>
        st.dispatch({ type: 'plan/wall/update', roomId: room.id, wallId: wall.id, patch: { thickness } })}
    />
    <div class="row">
      <Button icon="plus" onclick={() => st.addOpening(room.id, wall.id, 'door')}>Ajouter une porte</Button>
      <Button icon="plus" onclick={() => st.addOpening(room.id, wall.id, 'window')}>Ajouter une fenêtre</Button>
      <Button icon="plus" onclick={() => st.addOpening(room.id, wall.id, 'french-window')}>Ajouter une baie</Button>
      <Button onclick={() => st.splitWall(room.id, wall.id)}>Ajouter un point au milieu</Button>
    </div>
    {@render items(
      room.openings.filter((o) => o.wall === wall.id),
      [],
    )}
  {:else if room && sel?.kind === 'point'}
    {@render back(room)}
    <h2>Point {sel.index + 1} — {room.name}</h2>
    <p class="muted">Glissez le point pour changer la forme de la pièce.</p>
    <Button
      variant="danger"
      icon="trash"
      disabled={room.outline.length <= 3}
      onclick={() => st.removePoint(room.id, sel.index)}>Retirer ce point</Button
    >
  {:else if room}
    <Button variant="ghost" icon="back" onclick={() => st.select(null)}>Toutes les pièces</Button>
    <h2>{room.name}</h2>
    <TextField
      label="Nom de la pièce"
      value={room.name}
      onchange={(e) => {
        const name = e.currentTarget.value.trim();
        if (name) st.dispatch({ type: 'plan/room/update', roomId: room.id, patch: { name } });
      }}
    />
    <NumberField
      label="Hauteur sous plafond"
      unit="cm"
      factor={10}
      min={1}
      value={room.height}
      onchange={(height) => st.dispatch({ type: 'plan/room/update', roomId: room.id, patch: { height } })}
    />
    <h3>Murs</h3>
    <ul class="walls">
      {#each room.walls as w, i (w.id)}
        <li>
          <NumberField
            label="Mur {i + 1}"
            unit="cm"
            factor={10}
            min={1}
            value={wallLength(room, i)}
            onchange={(length) => st.dispatch({ type: 'plan/wall/length', roomId: room.id, wallId: w.id, length })}
          />
          <Button variant="ghost" onclick={() => st.select({ kind: 'wall', room: room.id, wall: w.id })}
            >Ouvertures et épaisseur ({cm(w.thickness)})</Button
          >
        </li>
      {/each}
    </ul>
    {@render items(room.openings, room.obstacles)}
    <div class="row">
      <Button icon="plus" onclick={() => st.addObstacle(room.id)}>Ajouter un obstacle</Button>
      <Button variant="danger" icon="trash" onclick={() => st.removeRoom(room.id)}>Supprimer la pièce</Button>
    </div>
  {:else}
    <h2>Pièces</h2>
    {#if st.plan.rooms.length}
      <ul class="rooms">
        {#each st.plan.rooms as r (r.id)}
          <li><Button block onclick={() => st.select({ kind: 'room', room: r.id })}>{r.name}</Button></li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Aucune pièce. Ajoutez la première : rectangle, forme en L ou en U, ou dessin libre.</p>
    {/if}
    <Button variant="primary" icon="plus" onclick={onaddroom}>Ajouter une pièce</Button>
  {/if}

  {#if st.errors.length && st.mode === 'select'}
    <section class="errors" aria-label="Problèmes à corriger">
      <h3>À corriger</h3>
      <ul>
        {#each st.errors as e, i (i)}
          <li>
            {#if e.room}<strong>{st.room(e.room)?.name} :</strong>{/if}
            {PLAN_MESSAGES[e.code]}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .panel {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .panel > :global(*) {
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  h3 {
    margin: var(--space-2) 0 0;
    font-size: var(--fs-md);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .walls,
  .rooms,
  .errors ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .walls li {
    display: grid;
    gap: var(--space-1);
  }
  .errors {
    padding: var(--space-3);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--thin) 8%, var(--sheet));
  }
  .errors h3 {
    margin: 0 0 var(--space-2);
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
</style>
