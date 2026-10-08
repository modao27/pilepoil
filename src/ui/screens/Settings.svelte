<script lang="ts">
  import Button from '../components/Button.svelte';
  import Screen from '../components/Screen.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { app, type Theme } from '../lib/app.svelte';
  import { libraries, modules } from '../../modules/registry';
  import { count } from '../lib/format';
  import { APP_VERSION, pwa } from '../lib/pwa.svelte';

  let appStatus = $state('');
  let checking = $state(false);

  async function checkUpdate() {
    checking = true;
    appStatus = 'Recherche en cours…';
    appStatus = await pwa.check();
    checking = false;
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
        {count(app.projects.length, 'projet', 'projets')}, enregistrés sur cet appareil uniquement. Bibliothèques :
        {libraries.map((l) => `${l.label.toLowerCase()} ${app.libraries[l.id]?.length ?? 0}`).join(', ')}.
      </p>
      {#each modules.filter((m) => m.screens.settings) as m (m.id)}
        {#await m.screens.settings!() then Section}<Section />{/await}
      {/each}
    </section>

    <section aria-labelledby="s-app">
      <h2 id="s-app">Application</h2>
      <ul class="facts">
        {#if app.oldApp}
          <li>
            Vos projets de l’ancienne appli Calepinage ont été repris ici. Si elle est encore installée sur cet
            appareil, vous pouvez la désinstaller : ses données restent intactes, mais elle n’est plus mise à jour.
          </li>
        {/if}
        <li>
          {#if pwa.offlineReady}
            Fonctionne sans connexion : l’application et vos projets sont sur cet appareil.
          {:else if pwa.supported}
            Préparation du mode sans connexion…
          {:else}
            Ce navigateur ne permet pas d’utiliser l’application sans connexion.
          {/if}
        </li>
        {#if !pwa.online}
          <li>Vous êtes hors ligne. Tout reste utilisable ; le partage du PDF peut attendre le retour du réseau.</li>
        {/if}
        <li>
          {#if pwa.persisted}
            Données protégées : le navigateur ne les effacera pas pour faire de la place.
          {:else}
            Le navigateur peut effacer les données s’il manque de place. Installer l’application les protège.
          {/if}
        </li>
      </ul>
      <div class="actions">
        {#if pwa.updateReady}
          <Button variant="primary" icon="download" onclick={() => void pwa.update()}>Mettre à jour maintenant</Button>
        {:else}
          <Button icon="download" disabled={checking || !pwa.supported} onclick={checkUpdate}
            >Rechercher une mise à jour</Button
          >
        {/if}
        {#if pwa.installable}
          <Button icon="plus" onclick={() => void pwa.install()}>Installer l’application</Button>
        {/if}
      </div>
      {#if !pwa.installable && !pwa.standalone}
        <p class="muted">
          Pour l’installer sur iPhone ou iPad : bouton Partager de Safari, puis « Sur l’écran d’accueil ».
        </p>
      {/if}
      <p class="status" role="status">{appStatus}</p>
      <p class="muted">Version {APP_VERSION}.</p>
    </section>

    <section aria-labelledby="s-about">
      <h2 id="s-about">À propos</h2>
      <p>
        Pilepoil — boîte à outils de rénovation : plan des pièces, calepinage du carrelage, quantités et liste d’achat.
      </p>
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
  .facts {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding-left: var(--space-4);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  a {
    display: inline-block;
    padding: var(--space-2) 0;
  }
</style>
