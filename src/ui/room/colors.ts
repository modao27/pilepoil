/**
 * Couleurs des poses sur l'écran Pièce et la vue globale : une teinte claire par pose (ordre du projet), assez
 * contrastée avec le trait du dessin en clair comme en sombre. Les libellés (nom de la pose) portent l'information,
 * la couleur ne fait que la répéter.
 */
const POSE_COLORS = ['#e3b98f', '#9cc3d8', '#b9d39c', '#d9b8dc', '#ead08f', '#a9cbc4', '#e6a9a2', '#c4c0e8'];

export const poseColor = (index: number): string => POSE_COLORS[index % POSE_COLORS.length]!;
