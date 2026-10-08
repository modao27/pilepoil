import type { Project } from '../../state/model';
import { app } from './app.svelte';

/**
 * Photo du carreau d'une zone pour le rendu 3D : URL chargée (sinon null, la photo arrive ensuite)
 * et retournements aléatoires permis (case de la zone, carreau sans sens imposé).
 */
export function scenePhoto(project: Project): (surface: number, zone: number) => { url: string; flip: boolean } | null {
  return (si, zi) => {
    const z = project.surfaces[si]?.zones[zi];
    const t = z ? app.tile(z.tileId) : undefined;
    if (!z || !t?.photoId) return null;
    app.loadPhoto(t.photoId);
    const url = app.photoUrls[t.photoId];
    return url ? { url, flip: z.photoRandomFlip && t.orientation !== 'none' } : null;
  };
}
