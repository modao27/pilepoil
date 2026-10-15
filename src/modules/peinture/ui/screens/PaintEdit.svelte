<script lang="ts">
  /** Formulaire de peinture (#/library/paints/<id> ou /new) : rôle, teinte, rendement, usages, pots et prix. */
  import { untrack } from 'svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import ColorSwatch from '../../../../ui/components/ColorSwatch.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import ItemInUseDialog from '../../../../ui/components/ItemInUseDialog.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { go } from '../../../../ui/lib/router.svelte';
  import { toast } from '../../../../ui/lib/toasts.svelte';
  import type { LibraryScreenProps } from '../../../types';
  import { createPaint, validatePaint, type Paint } from '../../core/paint';
  import type { PaintRole, PaintSheen, PaintUse, Tint } from '../../core/types';
  import { PAINT_ERRORS, ROLE_LABEL, SHEEN_LABEL, TINT_LABEL } from '../lib/messages';

  let { itemId: id }: LibraryScreenProps = $props();

  // Valeur initiale voulue : l'écran est recréé à chaque changement d'id ({#key} dans App.svelte).
  const existing = untrack(() => (id ? app.libraryItem<Paint>('paints', id) : undefined));
  let paint = $state<Paint>(
    existing ? structuredClone($state.snapshot(existing)) : createPaint(crypto.randomUUID(), Date.now(), { name: '' }),
  );
  let tried = $state(false);
  let colorName = $state(existing?.color?.name ?? '');
  // Prix vide = 0 dans le champ ; remis à null à l'enregistrement.
  let prices = $state(paint.packs.map((k) => k.price ?? 0));

  const errors = $derived(validatePaint(paint));
  const finish = $derived(paint.role === 'finish');
  const filler = $derived(paint.role === 'filler');
  const USES: { value: PaintUse; label: string }[] = [
    { value: 'walls', label: 'Murs' },
    { value: 'woodwork', label: 'Boiseries' },
    { value: 'humid', label: 'Pièces humides' },
  ];

  function setUse(u: PaintUse, on: boolean) {
    paint.uses = on ? [...paint.uses.filter((x) => x !== u), u] : paint.uses.filter((x) => x !== u);
  }

  function addPack() {
    const last = paint.packs.at(-1)?.size ?? 1;
    paint.packs = [...paint.packs, { size: last * 2, price: null }];
    prices = [...prices, 0];
  }

  function removePack(i: number) {
    paint.packs = paint.packs.filter((_, k) => k !== i);
    prices = prices.filter((_, k) => k !== i);
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    tried = true;
    if (errors.length) return;
    const p = $state.snapshot(paint);
    const out: Paint = {
      ...p,
      name: p.name.trim(),
      brand: p.brand.trim(),
      color: finish ? { name: colorName.trim(), hex: p.color?.hex ?? '#f4f1ea' } : null,
      sheen: finish ? p.sheen : null,
      packs: p.packs.map((k, i) => ({ size: k.size, price: prices[i]! > 0 ? prices[i]! : null })),
      updatedAt: Date.now(),
    };
    app.putLibraryItem('paints', out);
    toast(existing ? 'Peinture enregistrée.' : 'Peinture ajoutée à la bibliothèque.');
    go({ name: 'library', lib: 'paints' }, true);
  }

  function duplicate() {
    const copy: Paint = {
      ...$state.snapshot(paint),
      id: crypto.randomUUID(),
      name: paint.name + ' (copie)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    app.putLibraryItem('paints', copy);
    toast('Peinture dupliquée.');
    go({ name: 'libraryItem', lib: 'paints', id: copy.id }, true);
  }

  let blocked = $state<string | null>(null);

  function remove() {
    blocked = app.removeLibraryItem('paints', paint.id);
    if (blocked) return;
    toast(`Peinture « ${paint.name} » supprimée.`);
    go({ name: 'library', lib: 'paints' }, true);
  }
</script>

{#if id && !existing}
  <Screen title="Peinture introuvable" backHref="#/library/paints" backLabel="Peintures">
    <p>Cette peinture n’existe plus. <a href="#/library/paints">Revenir à la bibliothèque</a>.</p>
  </Screen>
{:else}
  <Screen title={existing ? existing.name : 'Nouvelle peinture'} backHref="#/library/paints" backLabel="Peintures">
    <form class="form" onsubmit={save} novalidate>
      <TextField label="Nom" bind:value={paint.name} maxlength={60} placeholder="Blanc mat murs et plafonds" />
      <TextField label="Marque" bind:value={paint.brand} maxlength={40} />
      <Select
        label="Rôle"
        bind:value={paint.role}
        options={(Object.keys(ROLE_LABEL) as PaintRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
      />

      {#if finish}
        <Select
          label="Aspect"
          value={paint.sheen ?? 'mat'}
          options={(Object.keys(SHEEN_LABEL) as PaintSheen[]).map((s) => ({ value: s, label: SHEEN_LABEL[s] }))}
          onchange={(v) => (paint.sheen = v)}
        />
        <TextField label="Nom de la teinte" bind:value={colorName} maxlength={40} />
        <ColorSwatch
          label="Couleur"
          value={paint.color?.hex ?? '#f4f1ea'}
          onchange={(v) => (paint.color = { name: colorName, hex: v })}
        />
        <Select
          label="Teinte"
          value={paint.tint ?? 'light'}
          options={(Object.keys(TINT_LABEL) as Tint[]).map((t) => ({ value: t, label: TINT_LABEL[t] }))}
          onchange={(v) => (paint.tint = v)}
        />
      {/if}

      <fieldset>
        <legend>Usages</legend>
        {#each USES as u (u.value)}
          <Checkbox label={u.label} checked={paint.uses.includes(u.value)} onchange={(c) => setUse(u.value, c)} />
        {/each}
      </fieldset>

      {#if !filler}
        <div class="grid">
          <NumberField
            label="Rendement"
            unit="m²/L"
            min={0}
            decimals={1}
            hint="Par couche, d’après le pot."
            bind:value={paint.yield}
          />
          <NumberField label="Couches conseillées" min={1} decimals={0} bind:value={paint.coats} />
        </div>
      {/if}

      <fieldset>
        <legend>Pots</legend>
        <ul class="packs">
          {#each paint.packs as _, i (i)}
            <li>
              <NumberField
                label={`Contenance ${i + 1}`}
                unit={filler ? 'kg' : 'L'}
                min={0}
                decimals={2}
                step={0.5}
                bind:value={paint.packs[i]!.size}
              />
              <NumberField label="Prix du pot" unit="€" min={0} decimals={2} step={0.5} bind:value={prices[i]!} />
              <Button variant="ghost" icon="trash" onclick={() => removePack(i)}>Retirer</Button>
            </li>
          {/each}
        </ul>
        <Button icon="plus" onclick={addPack}>Ajouter un pot</Button>
      </fieldset>

      {#if tried && errors.length}
        <ul class="errors" role="alert">
          {#each errors as e (e)}<li>{PAINT_ERRORS[e]}</li>{/each}
        </ul>
      {/if}

      <div class="row">
        <Button type="submit" variant="primary" icon="check">{existing ? 'Enregistrer' : 'Ajouter la peinture'}</Button>
        {#if existing}
          <Button icon="copy" onclick={duplicate}>Dupliquer</Button>
          <Button variant="danger" icon="trash" onclick={remove}>Supprimer la peinture</Button>
        {/if}
      </div>
    </form>
  </Screen>
  <ItemInUseDialog
    bind:project={blocked}
    title="Peinture utilisée"
    message={(p) =>
      `Cette peinture est utilisée dans le projet « ${p} ». Choisissez une autre peinture dans ce projet, puis supprimez-la.`}
  />
{/if}

<style>
  .form {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
  }
  fieldset {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
  }
  legend {
    padding: 0 var(--space-1);
    font-weight: 600;
  }
  .packs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  .packs li,
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
    align-items: end;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .errors {
    margin: 0;
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--thin) 8%, var(--sheet));
  }
</style>
