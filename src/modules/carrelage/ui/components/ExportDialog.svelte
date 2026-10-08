<script lang="ts">
  /** Export PDF (A4) : téléchargement, ou partage du fichier quand le téléphone le permet. */
  import type { ProjectResult } from '../../core';
  import type { Project } from '../../../../state/model';
  import { app } from '../../../../ui/lib/app.svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';

  let {
    open = $bindable(false),
    project,
    result,
  }: { open: boolean; project: Project; result: ProjectResult } = $props();

  let status = $state('');
  let busy = $state(false);

  const fileName = $derived(
    'calepinage-' +
      (project.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'projet') +
      '.pdf',
  );
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'test.pdf', { type: 'application/pdf' })] });

  async function make(): Promise<File | null> {
    busy = true;
    status = 'Préparation du PDF…';
    try {
      const { buildPdf } = await import('../lib/pdf');
      const blob = buildPdf({ project, spec: app.spec(project), result, tiles: app.tiles, date: Date.now() });
      return new File([blob], fileName, { type: 'application/pdf' });
    } catch {
      status = 'Création du PDF impossible. Réessayez.';
      return null;
    } finally {
      busy = false;
    }
  }

  async function download() {
    const f = await make();
    if (!f) return;
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    status = 'PDF enregistré dans vos téléchargements.';
  }

  async function share() {
    const f = await make();
    if (!f) return;
    try {
      await navigator.share({ files: [f], title: project.name, text: `Calepinage : ${project.name}` });
      status = 'PDF partagé.';
    } catch (e) {
      status = e instanceof DOMException && e.name === 'AbortError' ? '' : 'Partage impossible. Téléchargez le PDF.';
    }
  }
</script>

<Dialog bind:open title="Exporter en PDF" onclose={() => (status = '')}>
  <p>Résumé et liste d’achat, plan coté de chaque surface, plan de découpe et encollage, au format A4.</p>
  <p class="status" role="status">{status}</p>
  {#snippet actions()}
    {#if canShareFiles}<Button icon="upload" disabled={busy} onclick={share}>Partager</Button>{/if}
    <Button variant="primary" icon="download" disabled={busy} onclick={download}>Télécharger le PDF</Button>
  {/snippet}
</Dialog>

<style>
  .status {
    min-height: 1.4em;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
</style>
