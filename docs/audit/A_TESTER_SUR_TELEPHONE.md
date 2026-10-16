# À tester sur un vrai téléphone

Ce que l'émulation de Playwright ne peut pas vérifier. À cocher sur un iPhone (Safari) et un Android (Chrome), de
préférence un modèle d'entrée de gamme. Les identifiants entre parenthèses renvoient aux constats (`CONSTATS.md`) à
confirmer ou infirmer.

## Installation et lancement
- [ ] Android : bannière ou menu « Installer l'application » ; icône sur l'écran d'accueil (forme adaptative, pas de
      bord blanc) ; nom « PilePoil » sous l'icône.
- [ ] iPhone : Partager → « Sur l'écran d'accueil » ; icône (apple-touch-icon 180 px) et nom ; lancement en plein écran
      sans barre Safari.
- [ ] Écran de démarrage : Android (couleur de fond ivoire, icône) ; iPhone : aucune image de démarrage déclarée,
      regarder s'il y a un écran blanc et sa durée.
- [ ] Barre d'état : pétrole en thème clair, sombre en thème sombre ; lisibilité de l'heure et de la batterie.
- [ ] Encoche et barre d'accueil iOS : rien de caché sous l'encoche (barre du plan, du calepinage) ni sous la barre
      d'accueil (panneau tiré, bouton « Optimiser », résumé).
- [ ] Application installée lancée hors ligne (mode avion) : accueil, projet, calepinage, PDF.
- [ ] Mise à jour : après une nouvelle version, message « Une nouvelle version est disponible », « Mettre à jour » ne
      perd pas la saisie en cours.
- [ ] Ancienne application « Calepinage » installée : le message propose-t-il de la supprimer ?

## Saisie
- [ ] iPhone : toucher « Nom du projet », « Nom de la pièce », une liste (système de cloison, peinture) et un prix des
      achats : la page zoome-t-elle ? (UI-01, champs en 14 px)
- [ ] Clavier numérique proposé pour les cotes et les prix (inputmode decimal) ; virgule disponible.
- [ ] Le clavier masque-t-il le champ en cours (panneau tiré du plan à mi-hauteur, fenêtre « Nouveau projet », prix en
      bas de la liste d'achat) ?
- [ ] Dictée vocale d'une cote (« deux cent quarante ») : que devient la saisie ?
- [ ] Coller une fiche produit depuis le site d'un magasin (appui long → Coller).

## Gestes
- [ ] Dessin libre : toucher le premier point ferme-t-il la pièce ? (PLAN-03, clic fantôme supposé)
- [ ] Glisser un coin de pièce : le coin suit-il le doigt ? (PLAN-01)
- [ ] Pincer pour zoomer sur le plan, le calepinage, la 3D ; pas de zoom de la page entière à la place.
- [ ] Glisser le panneau tiré (3 crans) sans faire défiler la page ni tirer pour actualiser.
- [ ] Tirer pour actualiser (Chrome Android) juste après une saisie : la saisie est-elle gardée ? (PLAN-07)
- [ ] Bouton retour Android et geste retour iOS sur chaque écran : remonte d'un niveau, ne quitte pas l'application.
- [ ] Appui long sur le plan ou le calepinage : pas de menu contextuel ni de loupe de sélection de texte.
- [ ] Découpe du sol par une ligne : toucher au ras du bord sans quitter la découpe (PIE-01).

## Chantier
- [ ] Plein soleil, luminosité maximale : lisibilité du plan coté, des cotes (gris sur ivoire), des boutons pétrole, des
      couleurs coupée (ocre) / chute (vert) / coupe fine (terracotta).
- [ ] Avec des gants de travail (gants tactiles et gants ordinaires) : poignées des coins (44 px), « + » au milieu des
      murs, boutons − / + des champs, onglets du calepinage, cases des murs sur l'écran Pièce.
- [ ] Une seule main, pouce droit puis gauche : atteindre « Annuler », « Résultats », le panneau, « Optimiser ».
- [ ] Poussière ou doigt mouillé : touchers parasites pendant un glissement.
- [ ] Téléphone en paysage pendant l'édition du plan, puis retour en portrait : sélection et panneau gardés.
- [ ] Application en arrière-plan (appel, photo) puis reprise : projet et saisie intacts.
- [ ] Chantier sur plusieurs jours : rouvrir le projet le lendemain, retrouver le calepinage et la liste d'achat.

## Performances réelles
- [ ] Premier lancement en 4G faible : temps avant « Mes projets ».
- [ ] Recalcul d'un calepinage (changer le motif) sur une pièce de 30 m² : moins d'une seconde ?
- [ ] Optimiser le départ sur 100 m² de point de Hongrie : durée, téléphone réactif pendant ce temps.
- [ ] Vue 3D du projet maison : fluidité en tournant (l'émulation donne 24 i/s sur téléphone, 44 sur ordinateur) ;
      chauffe et batterie après 5 minutes.
- [ ] Dossier PDF du projet (18 pages) : durée de création, mémoire (pas de plantage sur un téléphone modeste).

## Fichiers et partage
- [ ] « Partager » le PDF : WhatsApp, courriel, Drive ; nom du fichier ; ouverture du PDF.
- [ ] « Télécharger le PDF » sur iPhone : où va le fichier, message affiché.
- [ ] CSV des achats ouvert dans Excel et Google Sheets sur téléphone : accents, colonnes, virgule décimale.
- [ ] Impression du PDF sur A4 (format, marges, lisibilité des cotes à l'échelle 1:20).

## Appareil photo
- [ ] Photo d'un carreau : « Choisir une photo » propose-t-il l'appareil photo ? Orientation de la photo, poids,
      affichage dans le rendu.
- [ ] Pas de photo de chantier ni de relevé photo dans l'application (absent, voir PROPOSITIONS.md).

## Données
- [ ] Navigation privée Safari : message « Impossible d'ouvrir vos données » lisible et compréhensible.
- [ ] Stockage presque plein : message « Enregistrement impossible », rien de perdu après avoir libéré de la place.
- [ ] Après installation, « Données protégées » apparaît-il dans les Réglages (stockage persistant accordé) ?
