<script lang="ts">
  /** Réglages, section du carrelage : import d'un fichier exporté par l'ancienne version. */
  import Button from '../../../../ui/components/Button.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { toast } from '../../../../ui/lib/toasts.svelte';
  import { importLegacy, importMessage, parseLegacyExport } from '../../storage/legacy/import';

  let input: HTMLInputElement;
  let status = $state('');
  let busy = $state(false);

  async function importFile(file: File | undefined) {
    if (!file) return;
    busy = true;
    status = 'Import en cours…';
    try {
      const sum = await importLegacy(app.db, parseLegacyExport(await file.text()));
      await app.reload();
      status = sum ? importMessage(sum) : 'Ce fichier ne contient aucun projet.';
      toast(status);
    } catch (e) {
      status = e instanceof Error ? e.message : 'Import impossible.';
    } finally {
      busy = false;
    }
  }
</script>

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

<style>
  .muted {
    color: var(--muted);
  }
  .status:empty {
    display: none;
  }
</style>
