# Parcours et navigation : projet, pièces, surfaces, zones, poses

Décidé le 2026-10-09 (phases N0 à N5 de `docs/PLAN.md`). Ce document fixe la cible ; l'état du code est
indiqué par **[Existe]** (vérifié), **[Existe ailleurs]** (la capacité existe mais pas au bon endroit du
parcours) et **[À créer]**.

## 1. Constat de départ (audit du 2026-10-09)

- L'application est rangée **par outil** : Projet → Carrelage ou Parquet, chacun avec ses écrans, son retour,
  ses résultats et son PDF. L'utilisateur pense **par pièce et par surface** (« le sol de la salle de bain »).
- Le revêtement n'est pas une propriété de la surface : chaque module garde ses réglages sur le plan ; rien
  n'empêche un même sol d'être carrelé et parqueté, et les deux quantités partent aux achats.
- Les deux calepinages divergent : carrelage = une surface à la fois, onglets, retour vers l'écran Carrelage,
  démarrage par un assistant ; parquet = une pose sur plusieurs pièces, un long panneau, retour vers le
  Projet, démarrage par un projet vide.
- On dessine dans le Plan mais on n'y choisit jamais une surface à revêtir ; la sélection directe n'existe que
  dans la vue Pièce du carrelage.
- La vue globale ne montre ni les pièces, ni les surfaces, ni ce qui reste à faire.
- Les résultats et les PDF couvrent tout un module, jamais une surface ou une pièce.

À garder : plan commun et son éditeur, les deux moteurs (recalcul permanent, jamais de résultat périmé),
enregistrement automatique avec annuler / rétablir, bibliothèques, achats consolidés, vue de la pièce dépliée
et 3D, chantier du parquet.

## 2. Principes

1. **Projet → Pièce → Surface → Zone → Pose.** Carrelage et parquet sont deux revêtements posés sur des zones,
   pas deux applications.
2. **La vue globale du projet est le centre** : on y revient d'un geste depuis tout écran de travail, elle dit
   ce qui existe et ce qui reste à faire.
3. **Les surfaces se choisissent sur le dessin** ; une liste reste disponible comme alternative accessible.
4. **Carrelage et parquet fonctionnent de la même manière** : même coquille d'écran, mêmes étapes de réglage,
   mêmes niveaux de résultats, même export. Seul le contenu métier des étapes diffère.
5. **Aucune perte silencieuse** : suppression d'une pièce, d'une zone ou d'une pose confirmée et détaillée,
   erreurs d'enregistrement visibles, annulation sûre.

## 3. Vocabulaire

| Terme | Sens |
|---|---|
| **Surface** | le sol d'une pièce, ou un mur (vient du plan) |
| **Zone** | partie d'une surface qui reçoit un revêtement ; par défaut toute la surface |
| **Pose** | un revêtement continu (module, produit, motif, alignement) sur une ou plusieurs zones |
| **Bande** | bande de motif dans une pose de carrelage (l'ancienne « zone » du carrelage) |

Exemples : un sol en carrelage côté cuisine et en parquet côté séjour (deux zones, deux poses) ; une crédence
carrelée de 90 à 150 cm (une zone de mur) ; un parquet ou un carrelage qui continue de l'entrée au couloir
par la porte (une pose, deux zones de sol) ; une crédence qui fait l'angle (une pose, deux zones de murs qui se
suivent).

## 4. Modèle

Les zones et les poses vivent **dans le projet** ; chaque module garde seulement les réglages de ses poses.

```ts
interface Project {
  plan: Plan;
  /** Parties de surfaces revêtues. Deux zones d'une même surface ne se recouvrent pas. */
  zones: Zone[];
  /** Revêtements continus ; chaque zone appartient à une pose. */
  poses: Pose[];
  /** Réglages de chaque module, par pose : modules[module].data.poses[poseId]. */
  modules: Record<ModuleId, ModuleDoc>;
}
interface Zone {
  id: Id;
  surface: { room: Id; wall: Id | null };   // wall null : le sol
  /** Contour : repère du plan pour un sol, repère du mur (x le long du mur, y depuis le sol) pour un mur. */
  region: Polygon[];                        // contours > 0, trous < 0 (obstacles)
  pose: Id;
}
interface Pose {
  id: Id;
  module: ModuleId;                         // 'carrelage' | 'parquet'
  name: string;                             // « Pose 1 », modifiable
}
```

Règles (contrôlées à la création, pas seulement signalées) :
- deux zones d'une même surface ne se recouvrent pas ; une partie de surface peut rester sans revêtement ;
- une pose ne mélange pas sols et murs ;
- une pose de sol sur plusieurs pièces : pièces reliées par un passage ;
- une pose de murs sur plusieurs murs : murs qui se suivent dans une même pièce (angle rentrant ou sortant) ;
- le parquet ne se pose qu'au sol (l'action est grisée sur un mur, avec la raison).

Contrat de module (ajouts) : surfaces prises en charge, réglages par défaut d'une pose, calcul d'une pose,
état d'une zone, résumé et PDF d'une zone, d'une pièce et du projet, maillages 3D.

Pas de conversion des projets existants (aucun projet à garder) : nouvelle version de la base, les projets
précédents sont retirés.

Capacités des moteurs :
- parquet : pose sur plusieurs pièces par les passages, pose limitée à une partie de pièce, alerte de
  recouvrement **[Existe]** ;
- carrelage : surface de contour quelconque (sol découpé, crédence) **[Existe]** ; mur replié aux angles
  **[Existe]** dans le moteur (parité legacy), à rebrancher pour une pose sur des murs qui se suivent ;
  pose sur plusieurs sols **[À créer]**, à prouver par un test chiffré (union des zones par la porte, même
  alignement, même plan de découpe).

## 5. Écrans

| # | Écran | Adresse | État |
|---|---|---|---|
| 1 | Mes projets | `#/` | [Existe] |
| 2 | Nouveau projet : le nom seulement | `#/new` | [Existe], à simplifier |
| 3 | **Vue globale du projet** | `#/p/:id` | [Existe], à refaire |
| 4 | Plan : dessin et cotes | `#/p/:id/plan` | [Existe] |
| 5 | **Pièce** : surfaces, zones et poses sur le dessin | `#/p/:id/r/:pièce` | [Existe ailleurs] (vue Pièce du carrelage) |
| 6 | **Calepinage d'une pose** | `#/p/:id/pose/:pose` | [Existe] dans chaque module ; coquille commune [À créer] |
| 7 | **Résultats** surface, pièce ou projet, avec export | `…/resultats` à chaque niveau | [À créer] par surface et par pièce |
| 8 | Achats du projet | `#/p/:id/achats` | [Existe] |
| 9 | Chantier (parquet) | `#/p/:id/pose/:pose/chantier` | [Existe] sous une autre adresse |
| 10 | Bibliothèques, Réglages | `#/library`, `#/settings` | [Existe] |

L'assistant carrelage est retiré : ses formes types existent dans « Ajouter une pièce », ses étapes Carreau et
Motif deviennent les étapes du calepinage.

### Repère permanent
- En-tête des écrans 4 à 9 : fil « Projet › Salle de bain › Sol › Carrelage – Pose 1 », chaque élément est un
  lien ; « Projet » ramène toujours à la vue globale. Sur téléphone : « ‹ Salle de bain · Sol » et un bouton
  « Projet ».
- Le retour (geste, navigateur) remonte d'un niveau, jamais vers l'accueil.

### 3. Vue globale
- Plan d'ensemble cliquable : toucher une pièce ouvre l'écran Pièce.
- Liste des pièces ; pour chacune ses surfaces revêtues, leurs poses et leur état ; chaque ligne ouvre la pose.
- Actions : Ajouter une pièce (formes types), Modifier le plan, Résultats du projet (3D), Achats, Dossier du
  projet. État vide : « Ajoutez votre première pièce ».

### 5. Pièce
- Dessin : sol au centre, murs dépliés le long de leur segment ; zones colorées et étiquetées par pose
  (« Carrelage · Pose 1 »), parties sans revêtement hachurées. États lisibles sans la couleur (trait épais et
  libellé pour la sélection, motif de carreaux ou de lames pour une zone revêtue, pastille « ! » à compléter).
- Toucher le sol ou un mur : il est sélectionné (un glissement déplace la vue, il ne sélectionne pas). Panneau :
  zones de la surface et leur pose ; « Revêtir toute la surface » ; « Découper en zones » (ligne ou contour sur
  un sol, hauteurs et largeur sur un mur) ; « Ajouter à une pose existante » ; « Voir le calepinage ».
- Toucher une zone : changer sa pose, la retirer, ouvrir le calepinage.
- Sous le dessin : la liste des surfaces et de leurs zones (alternative accessible).
- Résultats de la pièce et 3D de la pièce (carrelage et parquet ensemble).

### 6. Calepinage d'une pose (même coquille pour les deux revêtements)
- Dessin de toute la pose (toutes ses zones et pièces), zone d'origine en avant ; panneau latéral sur
  ordinateur, panneau tiré du bas sur téléphone ; barre de résumé vers les résultats.
- Étapes du panneau, dans cet ordre (valeurs conservées quand on replie) :

| Étape | Carrelage | Parquet |
|---|---|---|
| 1. Produit | carreau, joint | lame |
| 2. Pose | motif, angle, départ, optimisation | motif, angle, axe, décalage, optimisation |
| 3. Découpage | bandes, réservations, finitions des ouvertures | seuils, continuité entre pièces |
| 4. Finitions | bords cachés, plinthes, profilés | sous-couche, plinthes, barres de seuil |
| 5. Avancé (replié) | perte par coupe, chute minimale | jeu périphérique, coupe mini, rangs de bord |

### 7. Résultats et export

| Niveau | Contenu | 3D | Export |
|---|---|---|---|
| Surface (ou zone) | aperçu, pièces posées, découpe | la surface | « PDF du calepinage — Cuisine, sol » |
| Pièce | toutes les poses de la pièce, totaux par revêtement | la pièce, revêtements ensemble | « PDF de la pièce » |
| Projet | tous les revêtements, achats consolidés | tout le logement | « Dossier du projet », achats PDF et CSV |

Honnêteté des chiffres : les chutes sont réutilisées sur toute une pose (parquet) ou tout le projet
(carrelage). Les pièces posées et leurs coupes sont exactes par surface ; les quantités à commander sont
celles de la pose (« à commander pour toute la pose »), jamais inventées par surface.

États d'une zone : non revêtue, à compléter (produit manquant…), erreur de calcul, prête. Pas d'état
« à recalculer » (le calcul suit chaque changement, « Calcul… » pendant) ; pas d'état « exporté » (les PDF ne
sont pas gardés, l'application ne peut pas savoir s'ils sont à jour).

## 6. Transitions

| De | Action | Vers | Garde-fou |
|---|---|---|---|
| Mes projets | Nouveau projet, nom | Vue globale (vide) | Projet enregistré avant la navigation |
| Vue globale | Ajouter une pièce (forme, cotes) | Plan, pièce sélectionnée | Annuler |
| Plan | « Revêtements de la pièce » | Pièce | Plan enregistré à la sortie |
| Vue globale | Toucher une pièce | Pièce | — |
| Vue globale | Toucher une pose dans la liste | Calepinage de la pose | — |
| Pièce | Toucher le sol ou un mur | Même écran, surface sélectionnée | Sélection dans l'adresse |
| Pièce | « Revêtir toute la surface » → Carrelage | Calepinage de la nouvelle pose | Si une pose carrelage touche la zone : « Continuer la pose 1 ou nouvelle pose ? » |
| Pièce | Sol → « Découper en zones », tracer une ligne | Même écran, deux zones | Annuler ; aucune pose perdue |
| Pièce | Mur → « Crédence », 90 → 150 cm | Zone de mur | Bornée par la hauteur de la pièce, message clair |
| Pièce | Zone du mur 2 → « Ajouter à la pose du mur 1 » | La pose fait l'angle | Seulement des murs qui se suivent, sinon grisé avec la raison |
| Pièce (salon) | Zone du sol → « Continuer la pose de l'entrée » | Calepinage, deux pièces | Seulement si un passage relie les pièces |
| Pièce | Changer le revêtement d'une zone | Confirmation « Retirer cette zone de la pose 1 ? » | La pose garde ses autres zones et ses réglages |
| Calepinage | Fil « Salle de bain » ou retour | Pièce, même surface | Enregistrement automatique |
| Calepinage | Barre de résumé | Résultats de la surface | — |
| Résultats | Exporter le PDF | Même écran, fichier, message | Message de réussite seulement une fois le fichier produit ; échec avec « Réessayer » |
| Partout | « Projet » | Vue globale à jour | — |
| Plan | Supprimer une pièce revêtue | Confirmation listant les poses touchées | Annulation sûre |
| Plan | Modifier des cotes | — | Calcul suivi ; une zone qui sort de la pièce est rognée et signalée |
