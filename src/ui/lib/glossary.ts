/** Mots du métier expliqués en une ou deux phrases : aide contextuelle (i) et page « Comment ça marche ». */
export interface Term {
  /** Identifiant stable, utilisé par `HelpTip`. */
  id: string;
  /** Le mot, tel qu'il apparaît dans l'application. */
  word: string;
  /** Explication courte, sans jargon. */
  text: string;
}

export const GLOSSARY: readonly Term[] = [
  {
    id: 'calepinage',
    word: 'Calepinage',
    text: 'Le plan de pose : où va chaque carreau ou chaque lame, où l’on coupe, combien il en faut. PilePoil le calcule pour vous.',
  },
  {
    id: 'pose',
    word: 'Pose',
    text: 'Un revêtement posé sur une ou plusieurs surfaces (un sol, un mur) avec ses réglages : produit, motif, joint. Une pièce peut avoir plusieurs poses.',
  },
  {
    id: 'zone',
    word: 'Zone',
    text: 'La partie d’une surface que couvre une pose. Un mur peut avoir deux zones : une crédence carrelée en bas, de la peinture au-dessus.',
  },
  {
    id: 'bande',
    word: 'Bande',
    text: 'Une partie de la surface avec son propre motif ou son propre carreau, par exemple une frise le long d’un mur.',
  },
  {
    id: 'coupe-fine',
    word: 'Coupe fine',
    text: 'Un carreau coupé en lamelle très étroite : fragile et peu esthétique. Décaler le départ de la pose permet souvent de les éviter.',
  },
  {
    id: 'coupe-perdue',
    word: 'Coupe perdue',
    text: 'Un morceau coupé qu’on ne peut pas réutiliser ailleurs : il compte dans les chutes et dans ce qu’il faut acheter.',
  },
  {
    id: 'chutes',
    word: 'Chutes de coupe',
    text: 'La part de matériau coupée et jetée. Les chutes réutilisables (un reste de carreau pour un autre mur) ne comptent pas.',
  },
  {
    id: 'marge',
    word: 'Marge d’achat',
    text: 'Le pourcentage ajouté à la quantité calculée pour couvrir la casse et les erreurs. C’est un réglage, pas un résultat.',
  },
  {
    id: 'rang-de-bord',
    word: 'Rang de bord',
    text: 'La dernière rangée contre un mur ou un angle. C’est elle qui est coupée ; on cherche à ce qu’elle ne soit pas trop étroite.',
  },
  {
    id: 'etat-des-lieux',
    word: 'État des lieux',
    text: 'Le plan de la pièce telle qu’elle est aujourd’hui, avant les travaux. C’est là qu’on dessine murs, portes, fenêtres et obstacles.',
  },
  {
    id: 'travaux',
    word: 'Travaux',
    text: 'Ce qui change : cloisons neuves, murs démolis. Les revêtements se posent sur le plan après travaux.',
  },
  {
    id: 'niveau',
    word: 'Niveau du sol',
    text: 'La hauteur du sol fini d’une pièce par rapport au niveau 0 du plan. Une pièce plus basse a un niveau négatif ; la différence entre deux pièces reliées est une marche.',
  },
  {
    id: 'marche',
    word: 'Marche',
    text: 'La différence de niveau entre deux pièces reliées par un passage. À partir de 5 mm, une pose ne peut plus continuer d’une pièce à l’autre.',
  },
  {
    id: 'surface',
    word: 'Surface',
    text: 'Un sol ou un mur à revêtir. On touche une surface pour choisir ce qu’on y pose.',
  },
];

export const term = (id: string): Term | undefined => GLOSSARY.find((t) => t.id === id);
