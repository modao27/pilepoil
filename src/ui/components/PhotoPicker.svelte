<script lang="ts">
  /**
   * Photo de carreau : fichier, coller (presse-papiers) ou glisser-déposer. Message d'état lu par les
   * lecteurs d'écran. L'image est réduite (640 px max) et rendue en Blob JPEG.
   */
  import Icon from '../icons/Icon.svelte';
  import Button from './Button.svelte';

  let {
    url = null,
    onpick,
    onremove,
  }: {
    /** Aperçu de la photo actuelle (object URL). */
    url?: string | null;
    onpick: (photo: { blob: Blob; width: number; height: number }) => void;
    onremove?: () => void;
  } = $props();

  let status = $state('');
  let over = $state(false);
  let input: HTMLInputElement;

  async function use(file: File | Blob | null | undefined) {
    if (!file || !/^image\//.test(file.type || 'image/')) {
      status = 'Ce fichier n’est pas une image. Choisissez une photo JPEG ou PNG.';
      return;
    }
    status = 'Chargement de la photo…';
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * k),
        h = Math.round(bmp.height * k);
      const c = new OffscreenCanvas(w, h);
      c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.84 });
      onpick({ blob, width: w, height: h });
      status = 'Photo appliquée.';
    } catch {
      status = 'Image illisible. Essayez une photo JPEG ou PNG.';
    }
  }

  function onpaste(e: ClipboardEvent) {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      void use(item.getAsFile());
    } else status = 'Aucune image dans le presse-papiers. Copiez la photo, puis collez-la ici.';
  }
</script>

<div class="pp">
  <div
    class="zone"
    class:over
    role="group"
    aria-label="Photo du carreau"
    ondragover={(e) => (e.preventDefault(), (over = true))}
    ondragleave={() => (over = false)}
    ondrop={(e) => {
      e.preventDefault();
      over = false;
      void use(e.dataTransfer?.files[0]);
    }}
  >
    {#if url}
      <img src={url} alt="Carreau actuel" />
    {:else}
      <Icon name="photo" size={32} />
    {/if}
    <p class="muted">Glissez une photo ici, collez-la, ou choisissez un fichier.</p>
    <div class="actions">
      <Button icon="upload" onclick={() => input.click()}>Choisir une photo</Button>
      <textarea
        class="paste"
        aria-label="Coller une photo"
        placeholder="Coller ici"
        rows="1"
        {onpaste}
        oninput={(e) => (e.currentTarget.value = '')}></textarea>
      {#if url && onremove}<Button variant="danger" icon="trash" onclick={onremove}>Retirer</Button>{/if}
    </div>
    <input
      bind:this={input}
      type="file"
      accept="image/*"
      hidden
      onchange={(e) => {
        void use(e.currentTarget.files?.[0]);
        e.currentTarget.value = '';
      }}
    />
  </div>
  <p class="status" role="status">{status}</p>
</div>

<style>
  .pp {
    display: grid;
    gap: var(--space-1);
  }
  .zone {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px dashed var(--field-border);
    border-radius: var(--r-panel);
    background: var(--sheet);
    text-align: center;
  }
  .zone.over {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  img {
    width: 96px;
    height: 96px;
    object-fit: cover;
    border-radius: var(--r-field);
  }
  p {
    font-size: var(--fs-sm);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
  }
  .paste {
    width: 120px;
    min-height: var(--touch);
    padding: var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    resize: none;
    text-align: center;
  }
  .status {
    min-height: 1.2em;
    font-size: var(--fs-xs);
    color: var(--muted);
  }
</style>
