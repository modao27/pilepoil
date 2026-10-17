<script lang="ts">
  /** Réglages de l'élément choisi sur le plan ; sans sélection, liste des pièces et problèmes à corriger. */
  import type { Obstacle, Partition, PartitionOpening, PlanRoom, WallOpening } from '../../core/plan/types';
  import HelpTip from '../components/HelpTip.svelte';
  import { wallIndex, wallLength } from '../../core/plan/walls';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Select from '../components/Select.svelte';
  import Checkbox from '../components/Checkbox.svelte';
  import { passageStep, roomFloor, stepAdvice, wallHeight } from '../../core/plan/levels';
  import { EQUIPMENT, EQUIPMENT_KINDS, floorUnder, type ObstacleKind } from '../../core/plan/equipment';
  import TextField from '../components/TextField.svelte';
  import { formatNumber } from '../lib/calc';
  import { PLAN_MESSAGES, WORKS_MESSAGES } from '../lib/planMessages';
  import type { OpeningKind, PlanEditorState } from './planState.svelte';

  let { st, onaddroom }: { st: PlanEditorState; onaddroom: () => void } = $props();

  /** Pièce à supprimer en attente de confirmation (elle porte des revêtements). */

  const KINDS: { value: OpeningKind; label: string }[] = [
    { value: 'door', label: 'Porte' },
    { value: 'french-window', label: 'Baie' },
    { value: 'window', label: 'Fenêtre' },
  ];
  const OBSTACLES = (Object.keys(EQUIPMENT) as ObstacleKind[]).map((value) => ({
    value,
    label: EQUIPMENT[value].label,
  }));
  /** Équipement à ajouter (WC, receveur…). */
  let equipment = $state<ObstacleKind>('toilet');
  const EQUIPMENTS = EQUIPMENT_KINDS.map((value) => ({ value, label: EQUIPMENT[value].label }));
  /** « Marche de 15 cm, descendante vers Séjour » ; « Sans marche » si les sols sont au même niveau. */
  const stepText = (step: number, a?: string, b?: string) =>
    step === 0
      ? 'Sans marche : les deux sols sont au même niveau.'
      : `Marche de ${formatNumber(Math.abs(step) / 10, 1)} cm, ${step < 0 ? 'descendante' : 'montante'} vers ${b ?? '?'} depuis ${a ?? '?'}.`;
  const ADVICE = {
    flat: '',
    bar: 'Une barre de seuil de rattrapage finit la jonction des deux sols (vérifier la notice du fabricant).',
    nosing: 'Un nez de marche finit la jonction : la différence est trop grande pour une barre de seuil.',
  } as const;
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

  const LAYERS = [
    { value: 'existing' as const, label: 'État des lieux' },
    { value: 'works' as const, label: 'Travaux' },
  ];
  const ALIGNS: { value: Partition['align']; label: string }[] = [
    { value: 'right', label: 'À droite' },
    { value: 'center', label: 'Centrée' },
    { value: 'left', label: 'À gauche' },
  ];
  const LOCKS = [
    { value: '', label: 'Libre' },
    { value: 'exterior', label: 'Extérieur' },
    { value: 'bearing', label: 'Porteur' },
  ];
  const length = (q: Partition) => Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
  const existing = $derived(st.doc.site.existing);
  const wallName = (roomId: string, wallId: string) => {
    const r = existing.rooms.find((x) => x.id === roomId);
    return r ? `${r.name}, mur ${r.walls.findIndex((w) => w.id === wallId) + 1}` : '?';
  };

  const sel = $derived(st.sel);
  const partition = $derived(sel?.kind === 'partition' ? st.partition(sel.partition) : undefined);
  const demolition = $derived(sel?.kind === 'demolition' ? st.demolition(sel.demolition) : undefined);
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
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  };

  function updateOpening(patch: Partial<Omit<WallOpening, 'id'>>, key?: string) {
    if (room && opening)
      st.dispatch({ type: 'plan/opening/update', roomId: room.id, openingId: opening.id, patch }, key);
  }
</script>

{#snippet worksBack()}
  <Button variant="ghost" icon="back" onclick={() => st.select(null)}>Tous les travaux</Button>
{/snippet}

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

{#snippet worksIssues(ids: string[])}
  {#each st.issuesOf(...ids) as i (i.code + i.id)}
    <p class={i.severity === 'error' ? 'bad' : 'warn'}>{WORKS_MESSAGES[i.code]}</p>
  {/each}
{/snippet}

{#snippet opening2(q: Partition, o: PartitionOpening, n: number)}
  <fieldset class="opening">
    <legend>{o.kind === 'door' ? 'Porte' : 'Baie'} {n}</legend>
    {@render worksIssues([o.id])}
    <NumberField
      label="Largeur"
      unit="cm"
      factor={10}
      min={10}
      value={o.width}
      onchange={(width) => st.updatePartitionOpening(q.id, o.id, { width })}
    />
    <NumberField
      label="Distance au début"
      unit="cm"
      factor={10}
      min={0}
      value={o.offset}
      onchange={(offset) => st.updatePartitionOpening(q.id, o.id, { offset })}
    />
    <NumberField
      label="Hauteur"
      unit="cm"
      factor={10}
      min={10}
      value={o.height}
      onchange={(height) => st.updatePartitionOpening(q.id, o.id, { height })}
    />
    <Button variant="danger" icon="trash" onclick={() => st.removePartitionOpening(q.id, o.id)}>Supprimer</Button>
  </fieldset>
{/snippet}

<div class="panel">
  {#if st.mode !== 'draw' && st.mode !== 'link'}
    <Segmented label="Calque du plan" value={st.layer} options={LAYERS} onchange={(layer) => st.setLayer(layer)} />
    <p class="words">
      État des lieux <HelpTip id="etat-des-lieux" /> Travaux <HelpTip id="travaux" />
    </p>
  {/if}
  {#if st.mode === 'draw'}
    <h2>Dessiner une pièce</h2>
    <p class="muted">
      Touchez le plan pour placer chaque coin. Touchez le premier point pour fermer la pièce. Les points s’alignent sur
      les angles droits et sur une grille de 1 cm.
    </p>
    <p class="num">{st.draft.length} point{st.draft.length > 1 ? 's' : ''}</p>
    <div class="row">
      <Button variant="primary" disabled={st.draft.length < 3} onclick={() => st.closeDraw()}>Terminer la pièce</Button>
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
  {:else if st.mode === 'partition'}
    <h2>Tracer une cloison</h2>
    <p class="muted">
      {st.partitionFrom
        ? 'Touchez le point d’arrivée. La cloison se trace du premier au second point.'
        : 'Touchez le point de départ, sur un mur ou dans la pièce.'}
      Les points s’alignent sur les murs, les angles droits et une grille de 1 cm. Une face de la cloison est sur le trait
      tracé, l’épaisseur part à droite ; vous pourrez la centrer ou la passer à gauche ensuite.
    </p>
    <Button variant="ghost" onclick={() => st.cancelTool()}>Annuler</Button>
  {:else if st.mode === 'demolish'}
    <h2>Démolir un mur</h2>
    <p class="muted">
      Touchez un mur de l’état existant. Les murs extérieurs et porteurs (cadenas) ne se démolissent pas ;
      déverrouillez-les dans l’état des lieux si besoin.
    </p>
    <Button variant="ghost" onclick={() => st.cancelTool()}>Annuler</Button>
  {:else if partition}
    {@render worksBack()}
    <h2>{st.partitionName(partition.id)}</h2>
    {@render worksIssues([partition.id])}
    <p class="num">Longueur {cm(length(partition))}</p>
    <NumberField
      label="Épaisseur"
      unit="mm"
      min={20}
      max={300}
      value={partition.thickness}
      hint="Placo 72/48 : 72 mm ; 98/48 : 98 mm ; 100/70 : 100 mm."
      onchange={(thickness) => st.updatePartition(partition.id, { thickness })}
    />
    <Segmented
      label="Côté de l’épaisseur"
      value={partition.align}
      options={ALIGNS}
      onchange={(align) => st.updatePartition(partition.id, { align })}
    />
    <p class="muted">Dans le sens du tracé. Glissez les points des bouts pour déplacer la cloison.</p>
    <h3>Portes et baies</h3>
    {#each partition.openings as o, n (o.id)}
      {@render opening2(partition, o, n + 1)}
    {/each}
    <div class="row">
      <Button icon="plus" onclick={() => st.addPartitionOpening(partition.id, 'door')}>Ajouter une porte</Button>
      <Button icon="plus" onclick={() => st.addPartitionOpening(partition.id, 'opening')}>Ajouter une baie</Button>
    </div>
    <Button variant="danger" icon="trash" onclick={() => st.removePartition(partition.id)}>Supprimer la cloison</Button>
  {:else if demolition}
    {@const dr = existing.rooms.find((r) => r.id === demolition.room)}
    {@const dl = dr ? wallLength(dr, wallIndex(dr, demolition.wall)) : 0}
    {@render worksBack()}
    <h2>Démolition — {wallName(demolition.room, demolition.wall)}</h2>
    {@render worksIssues([demolition.id])}
    <NumberField
      label="Début"
      unit="cm"
      factor={10}
      min={0}
      max={Math.max(0, demolition.to - 10) / 10}
      value={demolition.from}
      hint="Distance depuis le début du mur."
      onchange={(from) => st.updateDemolition(demolition.id, { from })}
    />
    <NumberField
      label="Fin"
      unit="cm"
      factor={10}
      min={(demolition.from + 10) / 10}
      max={dl / 10}
      value={demolition.to}
      onchange={(to) => st.updateDemolition(demolition.id, { to })}
    />
    <p class="muted">
      Les pièces de part et d’autre s’unissent. Les portes de la partie démolie disparaissent. Supprimer la démolition
      rétablit le mur.
    </p>
    <Button variant="danger" icon="trash" onclick={() => st.removeDemolition(demolition.id)}
      >Supprimer la démolition</Button
    >
  {:else if st.layer === 'works'}
    <h2>Travaux</h2>
    <p class="muted">
      Dessinez des cloisons neuves et démolissez des murs. Les revêtements se posent sur les pièces après travaux. Les
      murs avec un cadenas (extérieurs, porteurs) ne se démolissent pas.
    </p>
    <div class="row">
      <Button variant="primary" icon="plus" disabled={!existing.rooms.length} onclick={() => st.startPartition()}
        >Tracer une cloison</Button
      >
      <Button disabled={!existing.rooms.length} onclick={() => st.startDemolish()}>Démolir un mur</Button>
    </div>
    {#if st.doc.site.partitions.length}
      <h3>Cloisons</h3>
      <ul class="rooms">
        {#each st.doc.site.partitions as q (q.id)}
          <li>
            <Button block onclick={() => st.select({ kind: 'partition', partition: q.id })}
              >{st.partitionName(q.id)} ({cm(length(q))})</Button
            >
          </li>
        {/each}
      </ul>
    {/if}
    {#if st.doc.site.demolitions.length}
      <h3>Démolitions</h3>
      <ul class="rooms">
        {#each st.doc.site.demolitions as d (d.id)}
          <li>
            <Button block onclick={() => st.select({ kind: 'demolition', demolition: d.id })}
              >{wallName(d.room, d.wall)}</Button
            >
          </li>
        {/each}
      </ul>
    {/if}
    {#if st.plan.rooms.length && !st.isNew}
      <Button variant="primary" href="#/p/{st.doc.id}">Choisir les revêtements</Button>
    {/if}
  {:else if passage}
    {@const a = st.room(passage.a.room)}
    {@const b = st.room(passage.b.room)}
    <Button variant="ghost" icon="back" onclick={() => st.select(null)}>Toutes les pièces</Button>
    <h2>Passage</h2>
    <p>Entre {a?.name ?? '?'} et {b?.name ?? '?'}.</p>
    {@const step = passageStep(st.plan, passage)}
    <p class="num" data-testid="step">{stepText(step, a?.name, b?.name)}</p>
    {#if step !== 0}<p class="muted">{ADVICE[stepAdvice(step)]}</p>{/if}
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
    <Checkbox
      label="Le revêtement du sol passe dessous"
      hint="Décoché : le sol est découpé autour de l’élément (receveur, baignoire, meuble)."
      checked={floorUnder(obstacle)}
      onchange={(v) =>
        st.dispatch({
          type: 'plan/obstacle/update',
          roomId: room.id,
          obstacleId: obstacle.id,
          patch: { floorUnder: v },
        })}
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
    {@const rb = box(room.outline)}
    <NumberField
      label="Distance au mur de gauche"
      unit="cm"
      factor={10}
      min={0}
      value={b.x - rb.x}
      onchange={(d) => st.moveObstacle(room.id, obstacle, rb.x + d, b.y)}
    />
    <NumberField
      label="Distance au mur du haut"
      unit="cm"
      factor={10}
      min={0}
      value={b.y - rb.y}
      onchange={(d) => st.moveObstacle(room.id, obstacle, b.x, rb.y + d)}
    />
    <p class="muted">Mesurées depuis le rectangle qui entoure la pièce. Vous pouvez aussi glisser l’obstacle.</p>
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
      max={10000}
      soft={{ min: 20, max: 3000 }}
      value={wallLength(room, wallI)}
      hint="Les murs suivants se déplacent pour garder les angles."
      onchange={(length) => st.dispatch({ type: 'plan/wall/length', roomId: room.id, wallId: wall.id, length })}
    />
    <NumberField
      label="Hauteur du mur"
      unit="cm"
      factor={10}
      min={1}
      max={room.height / 10}
      value={wallHeight(room, wall)}
      hint="Jusqu’au plafond par défaut ; un mur bas ou une allège est plus court."
      onchange={(height) =>
        st.dispatch({
          type: 'plan/wall/update',
          roomId: room.id,
          wallId: wall.id,
          patch: { height: height >= room.height ? undefined : height },
        })}
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
    <Select
      label="Verrou"
      value={wall.locked ?? ''}
      options={LOCKS}
      onchange={(v) => st.lockWall(room.id, wall.id, v === '' ? null : (v as 'exterior' | 'bearing'))}
    />
    <p class="muted">Un mur extérieur ou porteur (cadenas) ne se démolit pas dans les travaux.</p>
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
      max={2000}
      soft={{ min: 100, max: 600 }}
      value={room.height}
      onchange={(height) => st.dispatch({ type: 'plan/room/update', roomId: room.id, patch: { height } })}
    />
    <NumberField
      label="Niveau du sol"
      unit="cm"
      factor={10}
      min={-300}
      max={300}
      soft={{ min: -100, max: 100 }}
      value={roomFloor(room)}
      hint="Par rapport au niveau 0 du plan : une pièce plus basse a un niveau négatif."
      onchange={(floor) => st.dispatch({ type: 'plan/room/update', roomId: room.id, patch: { floor } })}
    />
    {@const mixed = room.walls.some((w) => w.thickness !== room.walls[0]!.thickness)}
    <NumberField
      label="Épaisseur des murs"
      unit="mm"
      min={1}
      max={1000}
      value={room.walls[0]?.thickness ?? 0}
      hint={mixed
        ? 'Épaisseurs différentes selon les murs : une valeur ici les remplace toutes.'
        : 'Tous les murs ; un mur à part se règle dans « Ouvertures et épaisseur ».'}
      onchange={(v) => st.setRoomThickness(room.id, v)}
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
    {@const neighbors = st.neighbors(room.id)}
    {#if neighbors.length}
      <h3>Pièces voisines</h3>
      <ul class="walls">
        {#each neighbors as f (f.a.wall + f.b.wall)}
          {@const mine = f.a.room === room.id ? f.a : f.b}
          {@const other = st.room(f.a.room === room.id ? f.b.room : f.a.room)}
          {@const linked = st.linked(f)}
          <li>
            <span
              >{other?.name}, de l’autre côté du mur {room.walls.findIndex((w) => w.id === mine.wall) + 1}{linked
                ? ' : reliée par une porte'
                : ''}</span
            >
            {#if !linked}
              <Button icon="plus" onclick={() => st.doorTo(f)}>Porte vers {other?.name}</Button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    <div class="row">
      <Button icon="plus" onclick={() => st.addObstacle(room.id)}>Ajouter un obstacle</Button>
    </div>
    <div class="equip">
      <Select label="Équipement" bind:value={equipment} options={EQUIPMENTS} />
      <Button icon="plus" onclick={() => st.addObstacle(room.id, equipment)}>Ajouter l’équipement</Button>
    </div>
    <div class="row">
      <Button variant="danger" icon="trash" onclick={() => st.askRemoveRoom(room.id)}>Supprimer la pièce</Button>
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
    <Button variant={st.plan.rooms.length ? 'secondary' : 'primary'} icon="plus" onclick={onaddroom}
      >Ajouter une pièce</Button
    >
    {#if st.plan.rooms.length}
      <Button onclick={() => st.lockExterior()}>Verrouiller les murs extérieurs</Button>
      <p class="muted">Les murs sans pièce en face sont verrouillés : on ne les démolit pas dans les travaux.</p>
    {/if}
    {#if st.plan.rooms.length && !st.isNew}
      <Button variant="primary" href="#/p/{st.doc.id}">Choisir les revêtements</Button>
    {/if}
  {/if}

  {#if st.layer === 'works' && st.mode === 'select' && st.issues.length}
    <section class="errors" aria-label="Problèmes des travaux">
      <h3>À corriger</h3>
      <ul>
        {#each st.issues as i (i.code + i.id)}
          <li>{WORKS_MESSAGES[i.code]}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if st.errors.length && st.mode === 'select' && st.layer === 'existing'}
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

<Dialog open={st.removing != null} title="Supprimer la pièce ?" onclose={() => (st.removing = null)}>
  {#if st.removing}
    <p>« {st.removing.room.name} » a des revêtements qui seront perdus avec elle :</p>
    <ul class="usage">
      {#each st.removing.usage as u (u)}<li>{u}</li>{/each}
    </ul>
    <p class="muted">Vous pourrez encore annuler juste après, tant que rien d’autre n’a changé.</p>
  {/if}
  {#snippet actions()}
    <Button onclick={() => (st.removing = null)}>Garder la pièce</Button>
    <Button
      variant="danger"
      icon="trash"
      onclick={() => {
        const id = st.removing!.room.id;
        st.removing = null;
        st.removeRoom(id);
      }}>Supprimer la pièce</Button
    >
  {/snippet}
</Dialog>

<style>
  .equip {
    display: grid;
    gap: var(--space-2);
  }
  .words {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }
  .usage {
    margin: 0;
    padding-left: var(--space-5);
  }
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
  .bad,
  .warn {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
  }
  .warn {
    border-left-color: var(--color-highlight);
  }
  fieldset.opening {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
  }
  fieldset.opening legend {
    font-weight: 600;
  }
</style>
