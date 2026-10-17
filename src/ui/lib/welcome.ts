/** Les trois étapes de PilePoil : présentation du premier lancement et page « Comment ça marche ». */
export interface Step {
  title: string;
  text: string;
}

export const STEPS: readonly Step[] = [
  {
    title: 'Dessinez vos pièces',
    text: 'Un rectangle, un L, un U, un relevé mur après mur ou un dessin libre. Ajoutez portes, fenêtres et obstacles : tout se règle en centimètres.',
  },
  {
    title: 'Touchez une surface pour la revêtir',
    text: 'Choisissez un sol ou un mur, puis carrelage, parquet ou peinture. Le plan de pose, les coupes et les quantités se calculent tout seuls.',
  },
  {
    title: 'Commandez juste ce qu’il faut',
    text: 'La liste d’achat regroupe tous les outils du projet, avec vos prix. Exportez-la en PDF ou en tableau pour passer commande.',
  },
];
