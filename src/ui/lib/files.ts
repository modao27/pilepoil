/** Fichiers produits par l'application (PDF, CSV) : nom, téléchargement, partage depuis le téléphone. */

/** « Salle de bain ⅓ » → « salle-de-bain » : nom de fichier sans accents ni espaces. */
export function fileSlug(name: string, fallback = 'projet'): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

/** Enregistre le fichier dans les téléchargements. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Le navigateur sait partager un PDF (téléphone surtout). */
export function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'test.pdf', { type: 'application/pdf' })] })
  );
}
