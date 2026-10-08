<script lang="ts">
  import Button from '../components/Button.svelte';
  import Screen from '../components/Screen.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { app, type Theme } from '../lib/app.svelte';
  import { count } from '../lib/format';
  import { toast } from '../lib/toasts.svelte';

  let input: HTMLInputElement;
  let status = $state('');
  let busy = $state(false);

  async function importFile(file: File | undefined) {
    if (!file) return;
    busy = true;
    status = 'Import en cours…';
    try {
      status = await app.importLegacyFile(file);
      toast(status);
    } catch (e) {
      status = e instanceof Error ? e.message : 'Import impossible.';
    } finally {
      busy = false;
    }
  }
</script>

<Screen title="Réglages" backHref="#/" backLabel="Accueil">
  <div class="sections">
    <section aria-labelledby="s-look">
      <h2 id="s-look">Apparence</h2>
      <Segmented
        label="Thème"
        value={app.theme}
        onchange={(t: Theme) => app.setTheme(t)}
        options={[
          { value: 'auto', label: 'Automatique' },
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
        ]}
      />
      <p class="muted">Automatique suit le réglage du téléphone ou de l’ordinateur.</p>
    </section>

    <section aria-labelledby="s-data">
      <h2 id="s-data">Données</h2>
      <p>
        {count(app.projects.length, 'projet', 'projets')} et {count(app.tiles.length, 'carreau', 'carreaux')},
        enregistrés sur cet appareil uniquement.
      </p>
      <h3>Ancienne version</h3>
      <p class="muted">
        Dans l’ancienne version, touchez « Exporter mes données » en bas des résultats, puis choisissez le fichier
        <code>calepinage-export-…json</code> ici.
      </p>
      <div>
        <Button icon="upload" disabled={busy} onclick={() => input.click()}>Importer un fichier</Button>
        <input
          bind:this={input}
          type="file"
          accept="application/json,.json"
          hidden
          onchange={(e) => {
            void importFile(e.currentTarget.files?.[0]);
            e.currentTarget.value = '';
          }}
        />
      </div>
      <p class="status" role="status">{status}</p>
    </section>

    <section aria-labelledby="s-about">
      <h2 id="s-about">À propos</h2>
      <p>Calepinage — préparation de pose de carrelage : coupes, chutes, quantités et liste d’achat.</p>
      <p class="muted">Les calculs sont indicatifs ; vérifiez les conseils de pose du fabricant.</p>
      <p><a href="#/demo">Voir le système de design</a></p>
    </section>
  </div>
</Screen>

<style>
  .sections {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
  }
  section {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .muted,
  .status {
    font-size: var(--fs-sm);
  }
  .status:empty {
    display: none;
  }
  a {
    display: inline-block;
    padding: var(--space-2) 0;
  }
</style>
