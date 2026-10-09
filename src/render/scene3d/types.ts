/** Types de la scène 3D partagée (repère three.js : x, y vers le haut, z ; mètres). */

export type Vec3 = [number, number, number];

/** Maillage prêt pour la scène : sommets, normales, couleurs linéaires par sommet, UV si photo. */
export interface MeshData {
  /** Clé de regroupement (matériau). */
  key: string;
  /** Photo (URL) appliquée en texture, ou null : couleur seule. */
  photo: string | null;
  positions: number[];
  normals: number[];
  /** Couleurs linéaires par sommet (r, g, b). */
  colors: number[];
  uvs: number[];
  castShadow: boolean;
  receiveShadow: boolean;
}

/**
 * Ce que la scène doit savoir pour cadrer et éclairer : genre de vue (un mur vu de face, un sol, une pièce)
 * et boîte englobante au sol [xmin, xmax] × [zmin, zmax] avec la hauteur.
 */
export interface SceneFrame {
  kind: 'wall' | 'floor' | 'room';
  bounds: { x: [number, number]; z: [number, number]; h: number };
}
