# PilePoil --- Cahier d'instructions UX/UI et fonctionnelles pour Claude Code

## Correction et optimisation de l'existant --- sans réécriture inutile

**Application concernée :** PilePoil\
**Déploiement connu :** https://modao27.github.io/pilepoil/#/\
**Dépôt :** https://github.com/modao27/pilepoil\
**Nature de la mission :** audit du code existant, corrections UX/UI et
fonctionnelles, simplification du parcours, amélioration responsive et
fiabilisation des transitions.

------------------------------------------------------------------------

# 0. Instruction prioritaire

Tu interviens sur une application existante. **Ta mission n'est pas de
repartir de zéro, ni de remplacer l'architecture par une nouvelle
application.** Tu dois d'abord comprendre le code, les composants, les
modèles de données, les routes, les fonctionnalités réellement présentes
et les tests existants, puis améliorer l'implémentation en conservant ce
qui fonctionne.

Le résultat attendu est une application plus compréhensible, plus
robuste et plus fluide, avec un parcours utilisateur cohérent depuis la
création d'un projet jusqu'à l'export du calepinage, tout en gardant une
vue globale du projet accessible en permanence.

## Règles impératives

1.  **Auditer avant de modifier.** Explore le dépôt et identifie le
    framework, l'architecture, les routes, les composants, la gestion
    d'état, la persistance, les fonctionnalités et les tests.
2.  **Préserver l'existant utile.** Réutilise les composants et
    fonctions actuels dès lors qu'ils sont sains. Ne duplique pas une
    fonctionnalité déjà présente.
3.  **Ne pas inventer de fonctionnalités déjà implémentées.** Vérifie le
    comportement réel dans le code avant de le modifier.
4.  **Ne pas supprimer de fonctionnalité sans justification explicite.**
    Si un comportement doit être remplacé, explique pourquoi et conserve
    les capacités utiles.
5.  **Éviter les refactorings massifs hors sujet.** Procède par
    améliorations ciblées et cohérentes. Une refonte structurelle n'est
    acceptable que si l'audit démontre qu'elle est nécessaire.
6.  **Protéger les données utilisateur.** Les modifications de
    navigation, de dessin, de surface, de revêtement et de calepinage ne
    doivent pas faire perdre silencieusement du travail.
7.  **Tester chaque étape.** Lance les tests disponibles, ajoute ou
    ajuste les tests nécessaires, puis vérifie les parcours sur mobile
    et desktop.
8.  **Distinguer les faits des hypothèses.** Si une fonction attendue
    n'existe pas, documente ce constat avant de décider comment la
    créer.
9.  **Respecter le périmètre actuel.** Le cœur du parcours porte sur la
    création de projet, le dessin des pièces, la sélection de surfaces,
    le choix du revêtement, le calepinage, les résultats et l'export.
    N'ajoute pas de modules métier sans rapport.
10. **Ne pas masquer les erreurs.** Les erreurs de validation, de
    calcul, de persistance ou d'export doivent être explicites et
    récupérables.
11. **Ne pas déclarer une tâche terminée sans preuve.** Indique les
    tests exécutés, leur résultat, les éventuelles limites et les
    fichiers modifiés.
12. **Ne pas écraser les changements utilisateur déjà présents dans le
    dépôt.** Vérifie l'état Git avant toute modification et n'annule
    aucune modification préexistante.

------------------------------------------------------------------------

# 1. Objectif produit

PilePoil doit permettre à une personne qui prépare des travaux de
rénovation de modéliser son projet, de définir les pièces et leurs
surfaces, de configurer un revêtement, de réaliser un calepinage, puis
de consulter et exporter les résultats.

Le parcours doit être accessible à tous les profils : - débutant qui ne
connaît pas le vocabulaire technique ; - utilisateur intermédiaire qui
veut paramétrer précisément son chantier ; - utilisateur avancé qui veut
aller vite et contrôler les détails.

L'interface ne doit pas imposer le même niveau de complexité à tout le
monde. Elle doit présenter d'abord les actions nécessaires, puis exposer
les réglages avancés au bon moment.

## Parcours de référence à rendre fluide

**Création du projet → dessin de la ou des pièces → sélection directe
d'un mur ou du sol sur le dessin → choix du revêtement (carrelage ou
parquet selon les capacités réellement disponibles) → calepinage →
résultats du calepinage → export spécifique du calepinage → retour à la
vue globale du projet.**

La **vue globale du projet** est le point central de l'application. Elle
doit rester accessible depuis les étapes de travail, sans obliger
l'utilisateur à repartir de zéro ou à traverser plusieurs écrans pour
revenir au projet.

Le parcours ci-dessus est la cible UX. Il ne présume pas que toutes les
fonctions existent déjà dans le code. L'audit initial doit établir
l'écart entre la cible et l'implémentation réelle.

------------------------------------------------------------------------

# 2. Contexte fonctionnel à vérifier dans le dépôt

Le projet est présenté comme une application web/PWA d'aide à la
rénovation. La documentation du dépôt décrit notamment : - un plan
commun des pièces ; - un module de calepinage de carrelage ; - des
zones, motifs, coupes et possibilités de réemploi des chutes ; - un
rendu 2D/3D ; - une bibliothèque de carreaux ou de lames ; - un PDF et
une liste d'achats consolidée ; - un module parquet décrit comme une
évolution prévue.

**Ces éléments doivent être vérifiés dans le code et dans l'application
actuelle avant toute conclusion.** Le README ne suffit pas à prouver
qu'une fonction est complète ou encore active.

Pendant l'audit, classe chaque capacité dans l'une des catégories
suivantes : - **Présente et fonctionnelle** ; - **Présente mais fragile
ou incomplète** ; - **Présente mais difficile à découvrir** ; -
**Partiellement implémentée** ; - **Absente** ; - **Obsolète ou
redondante**.

Ne présente jamais une capacité future comme si elle était déjà
disponible. En particulier, si le parquet n'est pas réellement
implémenté, ne fabrique pas artificiellement un parcours parquet
complet. Prévois plutôt une présentation honnête de l'état de la
fonction, ou laisse le module hors du parcours actif jusqu'à ce qu'il
soit réellement disponible.

------------------------------------------------------------------------

# 3. Phase 1 --- Audit obligatoire avant implémentation

Avant de changer le code, réalise un audit bref mais concret.

## 3.1 État du dépôt

-   Lire le README, les fichiers de configuration et les scripts
    disponibles.
-   Vérifier l'état Git : branche courante, modifications locales,
    fichiers non suivis.
-   Identifier les commandes de lancement, de build, de lint et de test.
-   Identifier les versions et dépendances principales.
-   Ne pas modifier les fichiers de configuration sans raison
    fonctionnelle ou technique explicite.
-   Ne pas réinstaller ou mettre à jour massivement les dépendances «
    par précaution ».

## 3.2 Cartographie de l'application

Identifier : - les routes et écrans ; - les composants principaux ; - le
modèle de données projet/pièce/surface/revêtement/calepinage ; - le
système de navigation ; - la gestion d'état ; - la persistance locale ou
distante ; - la logique de calcul du calepinage ; - la génération des
résultats et des exports ; - la gestion des erreurs ; - les points
d'entrée desktop et mobile.

Produire une carte concise des relations entre ces éléments dans le
compte rendu de l'audit. Ne crée pas obligatoirement un document séparé
dans le dépôt si cela ne sert pas le projet.

## 3.3 Vérification du modèle de données

Vérifier comment sont représentés les concepts suivants, et s'ils sont
réellement distincts :

-   **Projet** : ensemble du chantier.
-   **Pièce** : espace géométrique du projet.
-   **Surface** : sol, mur ou autre surface prise en charge.
-   **Revêtement** : matériau, référence produit, dimensions,
    orientation et paramètres associés.
-   **Calepinage** : résultat calculé et paramètres permettant de le
    reproduire.
-   **Export** : document généré à partir d'un état précis du projet ou
    du calepinage.

L'objectif conceptuel est que le projet contienne des pièces, que les
pièces possèdent des surfaces, que chaque surface puisse être configurée
avec un revêtement et que le calepinage soit associé à la surface
concernée. Toutefois, **ne migre pas le modèle de données vers cette
structure sans avoir étudié le modèle actuel**. Si le modèle existant
est différent mais cohérent, privilégie une adaptation progressive.

Vérifier notamment : - les identifiants stables ; - les relations entre
objets ; - les valeurs par défaut ; - les unités de mesure ; - la
validation des dimensions ; - la compatibilité des anciens projets ; -
la persistance des paramètres de calepinage ; - la façon dont les
exports sont associés à l'état du projet ; - les risques de perte de
données lors d'une migration.

## 3.4 Reproduire le parcours actuel

Tester l'application dans l'état actuel, si l'environnement le permet,
en suivant le parcours complet :

1.  créer un projet ;
2.  créer ou dessiner une pièce ;
3.  sélectionner une surface ;
4.  choisir ou configurer un revêtement ;
5.  lancer ou modifier le calepinage ;
6.  consulter les résultats ;
7.  exporter ;
8.  revenir à la vue globale ;
9.  rouvrir le projet et vérifier que les données sont conservées.

Pour chaque étape, noter : - ce que l'utilisateur voit ; - l'action
qu'il doit effectuer ; - les informations qu'il doit comprendre ; - les
points où il hésite ou risque de se tromper ; - les données saisies ; -
ce qui est conservé après navigation ; - les erreurs ou impasses
observées.

Si un navigateur ou un environnement de test n'est pas disponible,
l'indiquer et compenser par une lecture du code et des tests
automatisés. Ne prétends pas avoir effectué un test manuel qui n'a pas
été exécuté.

## 3.5 Livrable d'audit avant modification

Avant d'implémenter, formuler un diagnostic court : - architecture
actuelle ; - parcours actuel ; - fonctionnalités confirmées ; -
problèmes reproduits ; - risques de régression ; - ordre de priorité
proposé.

Ne bloque pas inutilement le travail en demandant une validation sur
chaque détail. Si les modifications sont réversibles, peu risquées et
conformes à ces instructions, avance après avoir documenté les choix.

------------------------------------------------------------------------

# 4. Principes UX non négociables

## 4.1 Le projet comme espace central

La vue globale doit servir de point d'entrée, de repère et de point de
retour.

L'utilisateur doit pouvoir : - comprendre l'état général du projet ; -
voir quelles pièces existent ; - repérer les pièces ou surfaces qui
nécessitent encore une configuration ; - ouvrir une pièce ou une surface
en un geste clair ; - revenir au projet depuis un éditeur, les résultats
ou l'export ; - poursuivre un travail déjà commencé sans devoir le
recréer.

La vue globale ne doit pas être un écran final ou un tableau de bord
décoratif. C'est l'espace central du parcours.

## 4.2 Sélection directe sur le dessin

Lorsque le plan représente une pièce et ses surfaces, l'utilisateur doit
pouvoir sélectionner directement la surface concernée sur le dessin,
dans la mesure où la représentation actuelle le permet.

Exemples : - toucher ou cliquer le sol pour configurer le sol ; -
toucher ou cliquer un mur identifié pour configurer ce mur ; - voir
clairement quelle surface est sélectionnée ; - ouvrir les actions et
paramètres associés à cette surface.

Ne force pas l'utilisateur à passer par une longue liste de surfaces si
celles-ci sont représentées de façon sélectionnable sur le dessin. Une
liste complémentaire peut rester disponible comme alternative accessible
ou comme solution de secours sur les petits écrans.

La sélection doit être non ambiguë : - état visuel sélectionné distinct
de l'état normal ; - nom ou type de la surface visible ; - indication de
la pièce à laquelle elle appartient ; - possibilité claire de changer de
surface ; - aucune sélection involontaire lors d'un déplacement, d'un
zoom ou d'un geste de dessin.

Si une surface n'est pas sélectionnable dans l'implémentation actuelle,
identifier le meilleur point d'intégration dans le composant de dessin
au lieu de créer un second éditeur géométrique indépendant.

## 4.3 Révéler la complexité au bon moment

Ne présente pas tous les paramètres de calepinage au premier écran.

Ordre d'information recommandé : 1. choisir la pièce et la surface ; 2.
choisir le type de revêtement ; 3. définir ou sélectionner le produit et
ses dimensions ; 4. obtenir un calepinage initial compréhensible ; 5.
ajuster les paramètres utiles ; 6. consulter les détails techniques ; 7.
exporter.

Les réglages avancés peuvent être repliés, regroupés ou placés dans un
panneau secondaire, à condition de rester accessibles et de ne pas
perdre les valeurs lorsqu'on les replie.

Ne supprime pas les fonctions avancées déjà utilisées par les profils
experts. Simplifie leur présentation, pas leur capacité.

## 4.4 Vocabulaire compréhensible

-   Employer les termes métier de façon constante.
-   Éviter de changer de terme pour désigner le même objet entre les
    écrans.
-   Ajouter une courte explication lorsqu'un terme technique est
    nécessaire.
-   Préférer des libellés d'action explicites : « Configurer le sol », «
    Modifier le revêtement », « Voir le calepinage », « Exporter le PDF
    ».
-   Éviter les libellés vagues tels que « Valider », « Continuer » ou «
    OK » lorsque l'action réelle peut être précisée.
-   Les messages d'erreur doivent expliquer le problème et la prochaine
    action possible.

Ne pas surcharger l'interface d'explications permanentes : utiliser une
hiérarchie visuelle claire, de l'aide contextuelle et des messages
courts.

## 4.5 Pas de perte silencieuse du travail

Les paramètres saisis doivent être conservés lors des navigations
ordinaires.

-   Revenir à la vue globale ne doit pas supprimer le calepinage.
-   Rouvrir une surface doit restituer ses paramètres.
-   Revenir des résultats à l'éditeur doit préserver les réglages.
-   Recalculer doit être une action identifiable lorsque cela prend du
    temps ou modifie des résultats.
-   Un changement qui invalide un résultat doit être signalé.
-   Une suppression ayant des conséquences doit être confirmée et
    expliquée.
-   Si une sauvegarde échoue, afficher un message et proposer une
    reprise ; ne pas faire comme si elle avait réussi.

Ne crée pas de confirmation intrusive pour chaque petite action si
l'application sauvegarde de façon fiable. Les confirmations sont
réservées aux opérations destructrices ou aux pertes réellement
possibles.

------------------------------------------------------------------------

# 5. Architecture de navigation cible

Cette architecture est une cible d'expérience, pas une injonction à
recréer les routes depuis zéro. Adapte-la aux routes et composants
existants.

## 5.1 Vue globale du projet

Contenu utile : - nom du projet ; - liste ou représentation des pièces
; - aperçu du plan ; - état de configuration des pièces et surfaces ; -
accès à la création ou à l'édition d'une pièce ; - accès à la surface à
configurer ; - accès aux résultats et exports du projet, si ceux-ci
existent ; - actions de gestion du projet.

La vue globale doit rester accessible depuis toutes les étapes par un
moyen de navigation constant : bouton de retour clairement libellé, fil
d'Ariane, navigation principale ou autre mécanisme cohérent avec
l'interface existante.

Ne multiplie pas les barres de navigation. Un seul mécanisme principal
et cohérent vaut mieux que plusieurs contrôles qui se chevauchent.

## 5.2 Navigation contextuelle

Quand l'utilisateur travaille sur une pièce ou une surface, il doit
savoir : - dans quel projet il se trouve ; - dans quelle pièce ; - sur
quelle surface ; - quelle étape est en cours.

Exemple de hiérarchie textuelle :
`Projet > Salle de bain > Sol > Carrelage`. Utilise ce modèle si la
structure visuelle s'y prête ; ne l'impose pas comme une barre
supplémentaire si l'écran est trop étroit.

## 5.3 Retour et reprise

Depuis chaque écran secondaire, prévoir un retour évident : - de
l'éditeur de pièce vers le projet ; - du choix de revêtement vers la
surface ; - du calepinage vers la surface ; - des résultats vers le
calepinage ; - de l'export vers les résultats ou le projet.

Le retour doit préserver l'état de travail et, si possible, la position
ou le contexte utile. Ne renvoie pas systématiquement à la page
d'accueil de l'application.

## 5.4 État de progression par pièce et surface

Si cela s'intègre proprement au modèle existant, utiliser des états
compréhensibles : - **À configurer** : surface ou revêtement incomplet
; - **À vérifier** ou **À recalculer** : un changement a invalidé un
résultat précédent ; - **Prêt** : calepinage exploitable ; - **Exporté**
: document généré, si cette information peut être maintenue de manière
fiable.

Attention : un export précédent ne signifie pas nécessairement que
l'état actuel est exporté. Si le projet a changé depuis, afficher que le
document précédent peut être obsolète. Ne conserve pas un état « à jour
» sans comparer l'état exporté à l'état actuel.

Ne présente pas le statut « Exporté » comme une vérité durable si le
système ne peut pas détecter les changements intervenus depuis l'export.

------------------------------------------------------------------------

# 6. Spécifications du parcours écran par écran

## 6.1 Création du projet

### Objectif

Créer rapidement un projet et arriver dans la vue globale, sans
formulaire disproportionné.

### Comportement attendu

-   Demander uniquement les informations réellement nécessaires pour
    créer le projet.
-   Proposer un nom clair ou un nom par défaut modifiable si cela
    correspond aux conventions existantes.
-   Valider les champs et afficher les erreurs à proximité.
-   Préserver la saisie en cas d'erreur.
-   Après création réussie, ouvrir la vue globale du projet.
-   Éviter de créer un projet vide sans expliquer à l'utilisateur la
    prochaine étape.
-   Si l'application permet déjà de créer un projet avec des métadonnées
    complémentaires, conserver ces capacités sans les rendre
    obligatoires si elles ne le sont pas.

### Points à vérifier

-   double soumission ;
-   nom vide ou composé uniquement d'espaces ;
-   noms longs ;
-   retour arrière après création ;
-   persistance après rechargement ;
-   comportement en cas d'échec de sauvegarde.

### Critère de réussite

Un nouvel utilisateur comprend où il se trouve et comment commencer à
dessiner ou ajouter sa première pièce.

## 6.2 Vue globale du projet

### Objectif

Fournir un repère permanent sur l'ensemble du chantier.

### Comportement attendu

-   Afficher les pièces existantes de façon compréhensible.
-   Montrer clairement les pièces configurées et celles qui restent à
    compléter.
-   Donner accès à l'ajout et à la modification des pièces.
-   Permettre d'ouvrir directement une pièce ou une surface.
-   Présenter un aperçu de plan utile, sans le transformer en tableau de
    bord surchargé.
-   Garder les actions principales visibles et les actions secondaires
    regroupées.
-   Afficher un état vide explicite lorsque le projet ne contient aucune
    pièce, avec une action claire pour commencer.

### État vide

Un écran vide ne doit pas simplement afficher une zone blanche ou une
liste vide. Il doit expliquer la prochaine action : « Ajoutez votre
première pièce » ou formulation équivalente.

### Critère de réussite

L'utilisateur peut répondre sans hésitation à trois questions : «
Quelles pièces ai-je créées ? », « Qu'est-ce qui reste à faire ? » et «
Où dois-je cliquer pour poursuivre ? ».

## 6.3 Dessin ou modification d'une pièce

### Objectif

Permettre de créer la géométrie de la pièce sans ambiguïté et sans
pièges tactiles.

### Comportement attendu

-   Conserver et améliorer l'outil de dessin existant.
-   Rendre les actions de dessin, de sélection, de déplacement et de
    zoom visuellement distinctes.
-   Afficher les dimensions et unités de manière cohérente.
-   Valider les dimensions impossibles ou non prises en charge.
-   Donner un retour visuel pendant le dessin.
-   Permettre de corriger une erreur sans devoir supprimer toute la
    pièce.
-   Préserver la géométrie lors d'un changement de panneau ou d'une
    navigation non destructive.
-   Indiquer clairement quand l'utilisateur modifie la géométrie d'une
    pièce existante plutôt que d'en créer une nouvelle.

### Points d'attention

-   Ne pas confondre sélection d'un élément et déplacement de cet
    élément.
-   Prévenir les dimensions nulles, négatives ou incohérentes.
-   Vérifier les angles, les unités et les arrondis.
-   Vérifier la lisibilité des poignées de manipulation sur téléphone.
-   Ne pas placer de commandes essentielles sous des zones système ou
    hors écran.
-   Ne pas supposer que la précision du pointeur tactile est identique à
    celle d'une souris.

### Modification d'une pièce déjà configurée

Si ses dimensions changent : - conserver autant que possible les
paramètres qui restent valides ; - déterminer si le calepinage est
désormais invalide ; - signaler clairement la nécessité de recalculer
; - ne pas continuer à afficher silencieusement un résultat obsolète
comme s'il était valide.

Si la géométrie ne peut pas être modifiée sans risque de corruption des
données, bloquer proprement l'opération et expliquer pourquoi plutôt que
de laisser le projet dans un état incohérent.

## 6.4 Sélection d'une surface directement sur le dessin

### Objectif

Réduire le nombre d'étapes entre la pièce et la configuration du
revêtement.

### Comportement attendu

-   Permettre de sélectionner le sol ou un mur directement sur le dessin
    lorsque ces surfaces sont représentées.
-   Mettre en évidence la surface active.
-   Afficher un libellé explicite de la surface sélectionnée.
-   Ouvrir les actions de configuration de cette surface.
-   Permettre de changer de surface sans perdre la configuration déjà
    saisie.
-   Prévoir une alternative par liste ou contrôle accessible lorsque la
    sélection graphique est difficile.

### États visuels à prévoir

-   surface non sélectionnée ;
-   surface survolée, uniquement si le dispositif prend en charge le
    survol ;
-   surface sélectionnée ;
-   surface configurée ;
-   surface nécessitant une action ou un recalcul.

Ne repose pas uniquement sur la couleur pour communiquer ces états.
Ajouter, selon le composant, un contour, une icône, un libellé ou un
autre signal visuel.

### Interaction tactile

-   Zones interactives suffisamment grandes.
-   Aucun contrôle essentiel qui dépend du survol.
-   Gestes de zoom et de déplacement non confondus avec la sélection.
-   Si le dessin utilise le glisser-déposer, différencier clairement un
    tap/clic d'un drag.
-   Éviter qu'un tap sur une surface lance une action destructive ou un
    changement de géométrie.

### Critère de réussite

L'utilisateur comprend qu'il peut sélectionner le sol ou un mur
directement sur le dessin, et voit immédiatement quelle surface il est
en train de configurer.

## 6.5 Choix du revêtement

### Objectif

Associer à la surface un type de revêtement et ses paramètres, en
distinguant les champs indispensables des options avancées.

### Comportement attendu

-   Présenter clairement les types réellement pris en charge.
-   Ne pas activer un parcours complet pour une catégorie non
    implémentée.
-   Permettre de sélectionner un produit dans la bibliothèque existante
    si elle est disponible.
-   Permettre la saisie manuelle des dimensions lorsque cette capacité
    existe ou doit être conservée.
-   Afficher les unités.
-   Valider les dimensions et paramètres avant calcul.
-   Montrer un résumé des choix avant d'ouvrir le calepinage.
-   Préserver les valeurs saisies lorsqu'on revient en arrière.

### Paramètres

N'affiche que les paramètres pertinents pour le revêtement sélectionné.
Par exemple, les dimensions, le format, l'orientation, le motif ou les
contraintes de pose peuvent être pertinents selon le module. Ne crée pas
des champs factices pour remplir un formulaire.

### Changement de type de revêtement

Lorsqu'un utilisateur change le type de revêtement : - identifier les
paramètres qui restent compatibles ; - conserver les paramètres
compatibles ; - réinitialiser uniquement ceux qui ne peuvent pas
s'appliquer ; - expliquer toute réinitialisation ayant un impact
important ; - invalider les résultats qui ne correspondent plus aux
paramètres actuels.

Ne supprime jamais silencieusement tous les réglages d'un calepinage à
cause d'un changement de catégorie.

### Critère de réussite

L'utilisateur sait quel revêtement est appliqué à quelle surface et
comprend quels paramètres sont nécessaires avant de calculer.

## 6.6 Calepinage

### Objectif

Permettre de générer puis d'ajuster un calepinage sans perdre le lien
avec la pièce et la surface d'origine.

### Comportement attendu

-   Identifier en permanence la pièce et la surface concernées.
-   Présenter un résultat initial compréhensible.
-   Séparer clairement l'aperçu du calepinage et les paramètres qui le
    modifient.
-   Préserver les fonctions métier existantes : motifs, zones, coupes,
    chutes ou réemploi si ces capacités sont réellement présentes.
-   Ne pas retirer une capacité avancée simplement parce qu'elle
    complique l'interface.
-   Permettre de revenir à la configuration du revêtement.
-   Rendre explicite la différence entre modification d'un paramètre et
    recalcul effectif.
-   Afficher un état de chargement lors d'un calcul coûteux.
-   Empêcher les interactions concurrentes incohérentes si plusieurs
    calculs peuvent être lancés.
-   Afficher une erreur compréhensible si le calcul échoue, sans effacer
    le dernier résultat valide si celui-ci peut être conservé.

### Réglages avancés

Regrouper les réglages par intention. Les noms exacts doivent rester
alignés avec le domaine et les libellés actuels. Les réglages peu
fréquents peuvent être repliés, mais leur valeur doit rester conservée.

### Résultat devenu obsolète

Si une modification invalide le résultat : - afficher « Recalcul
nécessaire » ou un libellé équivalent ; - ne pas présenter le résultat
précédent comme actuel ; - proposer une action explicite de recalcul ; -
si utile, conserver l'ancien résultat en aperçu avec un indicateur clair
« résultat précédent » ; - mettre à jour l'état seulement après la
réussite du nouveau calcul.

### Sortie du calepinage

L'utilisateur doit pouvoir : - revenir à la surface ou au revêtement ; -
consulter les résultats ; - revenir à la vue globale ; - retrouver le
même calepinage en rouvrant la surface.

Aucun de ces retours ne doit effacer les paramètres déjà saisis.

## 6.7 Résultats du calepinage

### Objectif

Transformer le calcul en informations exploitables pour préparer les
travaux.

### Contenu à préserver ou améliorer selon les capacités existantes

-   aperçu visuel du calepinage ;
-   quantités utiles ;
-   informations de coupe et de perte ;
-   synthèse des éléments nécessaires ;
-   détails nécessaires pour comprendre le résultat ;
-   accès à la modification des paramètres ;
-   action d'export spécifique au calepinage.

Ne fabrique pas de valeurs de quantité, de marge, de perte ou de prix.
Les chiffres doivent provenir du moteur de calcul et des données du
projet.

### Hiérarchie

Présenter d'abord les informations nécessaires à la décision, puis les
détails techniques. Ne masquer aucune donnée critique déjà disponible.

### Résultat invalide ou incomplet

Si le calcul est incomplet ou invalide, l'interface doit expliquer ce
qui manque et permettre de retourner au réglage correspondant. Éviter un
écran de résultats vide sans diagnostic.

### Critère de réussite

L'utilisateur comprend ce que le calepinage produit, ce qu'il doit
prévoir et comment modifier ou exporter ce résultat.

## 6.8 Export spécifique du calepinage

### Objectif

Permettre d'exporter le résultat du calepinage consulté, sans ambiguïté
sur la surface et le projet concernés.

### Comportement attendu

-   Nommer explicitement l'action d'export, par exemple « Exporter le
    PDF du calepinage », si le format PDF existe.
-   Identifier la pièce et la surface dans le document ou son contexte,
    selon les capacités existantes.
-   Gérer les erreurs de génération ou de téléchargement.
-   Ne pas afficher de confirmation de succès avant que l'export soit
    effectivement généré.
-   Laisser l'utilisateur revenir aux résultats ou au projet après
    l'export.
-   Ne pas bloquer le projet après l'export.
-   Ne pas supprimer ou remplacer des fichiers précédents sans
    avertissement si cela peut causer une perte.
-   Si un document exporté est conservé dans l'application, distinguer
    le document généré de l'état actuel du projet.

### Actualité de l'export

Un export reflète l'état du projet au moment de sa génération. Si les
paramètres changent ensuite : - marquer l'export précédent comme
potentiellement obsolète lorsque l'application peut le détecter ; -
proposer une nouvelle génération ; - ne pas prétendre que le PDF est
synchronisé en temps réel avec le projet.

### Critère de réussite

L'utilisateur sait quel calepinage il exporte et reçoit un retour fiable
sur le résultat de l'opération.

## 6.9 Retour à la vue globale après l'export

L'export ne doit pas constituer une impasse ni forcer à quitter le
projet.

Après export, l'utilisateur doit pouvoir : - revenir aux résultats du
calepinage ; - retourner à la surface ; - revenir à la vue globale ; -
poursuivre le travail sur une autre pièce.

Le retour au projet doit afficher un état cohérent avec les
modifications récentes. Si le projet comprend plusieurs pièces et
plusieurs revêtements, il doit rester possible de passer de l'une à
l'autre sans recommencer le parcours.

------------------------------------------------------------------------

# 7. États, sauvegarde et cohérence des données

## 7.1 Sauvegarde

Auditer le mécanisme actuel avant de le changer.

Vérifier : - à quel moment les données sont sauvegardées ; - si la
sauvegarde est automatique ou déclenchée par l'utilisateur ; - si les
erreurs sont remontées ; - si un rechargement de page conserve les
changements ; - si plusieurs modifications rapides peuvent se remplacer
ou s'écraser ; - si les calculs asynchrones peuvent écrire un résultat
ancien après un résultat récent ; - si les identifiants et relations
restent stables.

Ne remplace pas une persistance existante fonctionnelle par un système
différent sans raison solide.

## 7.2 État modifié / état sauvegardé

Si l'application peut avoir des modifications non sauvegardées, indiquer
clairement cet état. Le comportement doit être cohérent entre les
écrans.

Avant une action qui ferait perdre des changements non sauvegardés : -
sauvegarder automatiquement si cela est sûr et conforme à l'architecture
; - ou demander confirmation si la perte est réelle ; - ne jamais
abandonner silencieusement les changements.

## 7.3 Modifications qui invalident un calcul

Identifier les champs qui affectent réellement le résultat du calepinage
: dimensions de pièce, surface, produit, format, motif, orientation et
autres paramètres utilisés par le moteur.

Quand un champ pertinent change : - marquer le résultat comme obsolète
; - conserver les données de configuration ; - demander ou déclencher le
recalcul selon le comportement actuel et les coûts de calcul ; -
empêcher les résultats obsolètes d'être présentés comme à jour.

Ne déclenche pas un recalcul inutile après chaque frappe si cela rend
l'interface lente. Selon l'architecture, recalculer à la validation ou
avec un mécanisme contrôlé.

## 7.4 Suppression

Avant de supprimer une pièce ou une surface : - identifier les données
associées qui seront affectées ; - avertir si des revêtements,
calepinages ou exports internes liés seront perdus ou détachés ; -
proposer une action explicite ; - préserver les données sans lien si
possible.

Ne laisse pas de références orphelines ou d'écrans qui pointent vers des
objets supprimés.

## 7.5 Compatibilité des projets existants

Si le modèle de données change : - créer une migration ou une adaptation
rétrocompatible ; - gérer les projets anciens et les champs manquants
; - définir des valeurs par défaut sûres ; - ne pas supposer que tous
les projets ont été créés avec la version actuelle ; - tester au minimum
un projet neuf et un projet existant représentatif.

Ne change pas les formats persistés sans comprendre leur utilisation par
le reste de l'application.

------------------------------------------------------------------------

# 8. Responsive design : téléphone et ordinateur

Les deux formats sont des cibles de première classe. Ne considère pas le
mobile comme une version réduite du desktop.

## 8.1 Desktop

Organisation recommandée, à adapter au layout existant : - zone centrale
suffisamment large pour le plan ou le calepinage ; - panneau latéral
contextuel pour les propriétés et réglages ; - actions principales
faciles à trouver ; - contexte projet/pièce/surface toujours
compréhensible ; - pas de panneau qui écrase le plan au point de rendre
le dessin inutilisable.

Quand un panneau s'ouvre, vérifier que le dessin reste exploitable. Si
nécessaire, prévoir un panneau redimensionnable ou une disposition qui
préserve la surface de travail, sans introduire de complexité excessive.

## 8.2 Mobile

Organisation recommandée : - dessin ou calepinage visible en priorité
; - commandes essentielles atteignables sans gestes précis impossibles
; - panneau inférieur ou écran dédié pour les réglages denses, selon ce
qui s'accorde le mieux à l'architecture existante ; - actions
principales visibles ; - aucun défilement horizontal involontaire ; -
pas de champs ou de boutons masqués derrière le clavier virtuel ; -
retour au projet facile à atteindre ; - sélection directe des surfaces
utilisable au doigt.

Ne tente pas de conserver exactement la même disposition que sur
desktop. Conserve les mêmes concepts, le même vocabulaire et les mêmes
possibilités, mais adapte la composition.

## 8.3 Dimensions et interactions tactiles

-   Utiliser des cibles tactiles suffisamment grandes et espacées.
-   Vérifier la lisibilité des textes, dimensions, icônes et états.
-   Ne pas compter uniquement sur `hover`.
-   Éviter les actions qui exigent un clic de précision sur une ligne
    très fine du dessin.
-   Fournir une alternative à la sélection graphique si une surface est
    trop petite pour être ciblée.
-   Tester portrait et paysage si l'outil de dessin bénéficie réellement
    du paysage.
-   Vérifier le comportement avec le clavier virtuel ouvert.
-   Vérifier que les boutons fixes ne recouvrent pas les contenus ou les
    actions.

## 8.4 Breakpoints

Ne choisis pas arbitrairement une liste de breakpoints avant d'avoir
inspecté le CSS et les composants. Réutilise le système de responsive
existant si celui-ci est cohérent. Corrige les points de rupture
réellement observés.

Tester au minimum : - téléphone étroit autour de 320--360 px si le
projet le prend en charge ; - largeur mobile de référence de 390 px ; -
tablette ou largeur intermédiaire ; - desktop standard ; - grande
largeur desktop.

Le dépôt mentionne des tests Playwright sur téléphone 390 px et desktop
: vérifier ces tests et les étendre si nécessaire plutôt que de les
remplacer.

------------------------------------------------------------------------

# 9. Accessibilité et utilisabilité

L'accessibilité fait partie de la robustesse fonctionnelle.

Vérifier et améliorer : - navigation au clavier lorsque pertinente ; -
focus visible ; - labels associés aux champs ; - noms accessibles des
boutons iconographiques ; - ordre logique de navigation ; - contrastes
suffisants ; - messages d'erreur reliés aux champs concernés ; - états
qui ne reposent pas uniquement sur la couleur ; - alternatives
textuelles ou contrôles alternatifs pour les surfaces graphiques ; -
possibilité de fermer ou quitter les panneaux et dialogues ; -
comportement des dialogues sur petit écran.

Ne pas ajouter des attributs d'accessibilité factices : ils doivent
correspondre au comportement réel. Éviter les changements qui cassent
les interactions tactiles ou les contrôles du dessin.

------------------------------------------------------------------------

# 10. Performance et stabilité

Auditer les zones coûteuses avant d'optimiser.

Points à vérifier : - rendu du plan ; - recalcul du calepinage ; - rendu
2D/3D ; - mise à jour des panneaux de paramètres ; - chargement des
bibliothèques de produits ; - génération des exports ; - sauvegardes ; -
rerenders déclenchés par une modification locale ; - traitements
asynchrones concurrents.

Principes : - ne pas introduire de dépendance lourde pour une
amélioration mineure ; - éviter les optimisations prématurées ; - ne pas
mettre en cache un résultat sans mécanisme d'invalidation fiable ; - ne
pas supprimer une fonctionnalité métier pour améliorer artificiellement
les performances ; - fournir un état de chargement pour les opérations
longues ; - empêcher les actions répétées de déclencher plusieurs
opérations identiques si cela peut corrompre l'état.

Si un calcul est lent, mesure ou identifie la cause avant de modifier
son algorithme. Toute modification du moteur de calepinage doit être
protégée par des tests de non-régression sur les résultats.

------------------------------------------------------------------------

# 11. Messages, erreurs et états vides

Chaque écran important doit gérer au minimum : - état normal ; - état
vide ; - état de chargement, si une opération asynchrone existe ; -
erreur récupérable ; - données invalides ; - résultat obsolète ; -
absence de connexion ou échec de sauvegarde, si pertinent pour
l'architecture.

Les messages doivent répondre à trois questions : 1. Que s'est-il passé
? 2. Qu'est-ce que cela implique ? 3. Que puis-je faire maintenant ?

Exemples de formulations à adapter : - « Certaines dimensions sont
manquantes. Complétez-les pour calculer le calepinage. » - « Le plan a
changé. Recalculez le calepinage pour obtenir un résultat à jour. » - «
L'export n'a pas pu être généré. Vos paramètres sont conservés ;
réessayez. » - « Cette pièce contient un calepinage associé. Sa
suppression peut aussi supprimer ces données. »

Ne pas afficher de stack trace ou de détails techniques internes à
l'utilisateur final. Les détails utiles au diagnostic peuvent rester
dans la console ou les logs de développement, sans exposer
d'informations sensibles.

------------------------------------------------------------------------

# 12. Tests obligatoires

Commencer par comprendre les tests existants et leurs conventions.
Utiliser les outils et scripts déjà configurés.

## 12.1 Tests unitaires ou fonctionnels

Ajouter ou mettre à jour des tests pour les comportements critiques : -
validation des données de pièce ; - association d'un revêtement à une
surface ; - calcul et invalidation du calepinage ; - conservation des
paramètres ; - cohérence du statut après recalcul ; - génération des
résultats ; - gestion des erreurs d'export ; - compatibilité des projets
existants si le modèle change.

Ne modifie pas les assertions pour faire passer les tests sans vérifier
que le comportement attendu reste correct.

## 12.2 Tests de parcours end-to-end

Le parcours nominal à couvrir :

1.  ouvrir l'application ;
2.  créer un projet ;
3.  créer une pièce ;
4.  sélectionner le sol ou un mur sur le dessin ;
5.  configurer un revêtement disponible ;
6.  lancer ou consulter le calepinage ;
7.  modifier un paramètre et vérifier que le résultat devient obsolète
    ou est recalculé ;
8.  consulter les résultats ;
9.  exporter le calepinage ;
10. revenir à la vue globale ;
11. ouvrir une autre pièce ou surface ;
12. revenir à la première surface et vérifier la conservation des
    paramètres ;
13. recharger la page et vérifier la persistance selon le modèle de
    stockage actuel.

Les étapes qui concernent une fonction absente ne doivent pas être
simulées artificiellement : documenter l'absence et tester le meilleur
comportement existant.

## 12.3 Tests de transitions et cas limites

Vérifier notamment : - retour arrière depuis chaque étape ; - navigation
vers la vue globale depuis l'éditeur et les résultats ; - changement de
pièce ou de surface ; - changement de revêtement ; - modification des
dimensions après calcul ; - suppression d'une pièce configurée ; -
saisie invalide ; - double clic ou double soumission ; - échec de
sauvegarde ; - échec de calcul ; - échec d'export ; - ouverture d'un
projet ancien ; - rechargement en cours de travail ; - deux actions
rapides qui pourraient entrer en concurrence.

## 12.4 Tests responsive

Utiliser les tests Playwright existants s'ils sont présents. Tester au
minimum : - viewport téléphone 390 px ; - viewport desktop représentatif
; - une largeur intermédiaire ; - clavier virtuel simulé si l'outillage
le permet ; - interactions tactiles ou équivalents automatisés lorsque
c'est réaliste.

Vérifier les résultats visuellement, pas seulement l'absence d'erreur
JavaScript : - éléments hors écran ; - textes coupés ; - boutons masqués
; - panneaux qui recouvrent le dessin ; - défilement horizontal
involontaire ; - cible de surface trop difficile à sélectionner ; -
dialogues impossibles à fermer.

## 12.5 Critères de qualité

Avant de conclure : - lancer les tests pertinents ; - lancer le build
; - lancer lint/typecheck s'ils existent ; - expliquer les tests qui
n'ont pas pu être exécutés ; - ne pas prétendre qu'un test est passé
s'il n'a pas été lancé ; - ne pas ignorer les échecs préexistants : les
distinguer des régressions introduites.

------------------------------------------------------------------------

# 13. Stratégie d'implémentation

## 13.1 Priorités

Classer les problèmes par ordre de priorité :

### P0 --- Bloquant ou risque de perte de données

-   perte de données ;
-   projet impossible à rouvrir ;
-   calcul incohérent ;
-   export trompeur ou défaillant ;
-   navigation qui détruit l'état ;
-   corruption du modèle.

### P1 --- Rupture du parcours

-   impossible de comprendre l'étape suivante ;
-   retour au projet absent ou incohérent ;
-   surface impossible à sélectionner de façon fiable ;
-   résultats qui ne correspondent pas aux paramètres ;
-   interface mobile inutilisable.

### P2 --- Friction UX importante

-   trop d'étapes ;
-   libellés ambigus ;
-   paramètres trop denses ;
-   état du projet peu visible ;
-   retour à une surface trop compliqué ;
-   messages d'erreur peu utiles.

### P3 --- Finitions

-   espacements ;
-   cohérence des icônes ;
-   animations non essentielles ;
-   détails visuels ;
-   optimisations secondaires.

Traiter les problèmes P0 avant les problèmes esthétiques.

## 13.2 Petites étapes cohérentes

Procéder par lots : 1. audit et reproduction ; 2. corrections de
stabilité et de persistance ; 3. navigation et accès à la vue globale ;
4. sélection directe des surfaces ; 5. clarté de la configuration du
revêtement ; 6. calepinage et invalidation des résultats ; 7. résultats
et export ; 8. responsive et accessibilité ; 9. tests de non-régression
et finitions.

Adapte l'ordre aux dépendances réelles. Si un défaut d'architecture
bloque plusieurs corrections, résoudre d'abord ce défaut avec le plus
petit changement sûr possible.

Après chaque lot : - vérifier le diff ; - lancer les tests ciblés ; -
s'assurer que les fonctionnalités existantes utiles restent présentes
; - poursuivre sans attendre une validation manuelle après chaque
modification non risquée.

## 13.3 Limiter la taille des changements

-   Préférer plusieurs changements ciblés à une réécriture globale.
-   Éviter de renommer massivement des fichiers ou fonctions sans
    nécessité.
-   Éviter de changer de bibliothèque UI ou de moteur de rendu.
-   Ne pas remplacer le modèle de données uniquement pour qu'il
    corresponde à une architecture théorique.
-   Ne pas modifier des parties sans lien avec le parcours demandé.
-   Supprimer le code mort seulement après avoir vérifié qu'il n'est pas
    utilisé indirectement.
-   Ne pas modifier les textes ou le style visuel de manière arbitraire
    si cela ne sert pas l'objectif UX.

------------------------------------------------------------------------

# 14. Principes visuels

Le but est une interface claire et cohérente, pas un rebranding.

-   Préserver l'identité visuelle actuelle lorsqu'elle fonctionne.
-   Renforcer la hiérarchie entre action principale, actions secondaires
    et réglages avancés.
-   Réduire les éléments concurrents autour du plan.
-   Garder le plan ou le calepinage comme élément visuel principal
    lorsqu'il constitue l'objet de travail.
-   Utiliser les mêmes codes pour les mêmes états dans toute
    l'application.
-   Ne pas ajouter de couleurs uniquement décoratives si elles rendent
    les états moins lisibles.
-   Éviter les panneaux, bordures, badges et cartes superflus.
-   Préserver une densité raisonnable sur desktop et une hiérarchie
    simple sur mobile.
-   Les animations ne doivent pas ralentir ou empêcher les interactions.
-   Les icônes seules ne doivent pas remplacer des libellés lorsqu'une
    action est critique ou peu évidente.

Ne cherche pas à rendre tous les écrans identiques. Ils doivent partager
un langage visuel, mais chacun doit être optimisé pour son objectif.

------------------------------------------------------------------------

# 15. Définitions de « terminé »

Une amélioration n'est pas terminée simplement parce que le code
compile.

## Navigation

-   L'utilisateur peut revenir à la vue globale depuis les étapes
    principales.
-   Le retour ne perd pas le travail.
-   Le contexte projet/pièce/surface reste compréhensible.
-   Les routes ou états de navigation ne mènent pas à des impasses.

## Géométrie et surfaces

-   Le dessin existant reste fonctionnel.
-   Les surfaces prises en charge sont identifiables.
-   La sélection directe est fiable sur desktop et mobile, ou une limite
    clairement documentée est conservée si le dessin actuel ne permet
    pas encore cette fonction.
-   Les modifications de dimensions invalident les résultats concernés.

## Revêtement et calepinage

-   Les paramètres restent conservés lors des retours.
-   Les résultats correspondent à l'état actuel des données.
-   Les erreurs de calcul sont récupérables.
-   Les fonctionnalités métier existantes sont préservées.

## Résultats et export

-   Les résultats sont compréhensibles.
-   L'export porte sur le bon projet, la bonne pièce et la bonne
    surface.
-   L'échec d'export est signalé.
-   Le retour après export fonctionne.
-   Les exports antérieurs ne sont pas présentés comme actuels s'ils
    sont obsolètes.

## Responsive

-   Les parcours essentiels sont utilisables sur téléphone et
    ordinateur.
-   Aucun contrôle critique n'est masqué.
-   Le dessin reste exploitable.
-   Il n'y a pas de débordement horizontal involontaire.

## Qualité technique

-   Les tests pertinents passent, ou les échecs préexistants sont
    documentés.
-   Le build passe.
-   Les erreurs de lint/typecheck sont traitées ou expliquées.
-   Le diff reste cohérent avec le périmètre.
-   Aucune modification utilisateur préexistante n'a été écrasée.

------------------------------------------------------------------------

# 16. Ce qu'il ne faut pas faire

Ne fais pas les erreurs suivantes :

-   Ne réécris pas toute l'application avant d'avoir compris son
    architecture.
-   Ne remplace pas les composants de dessin ou de calepinage sans
    preuve qu'ils sont inadaptés.
-   Ne crée pas un second modèle de données parallèle.
-   Ne fabrique pas de résultats ou de valeurs de calcul.
-   Ne rends pas disponible un module qui n'est pas réellement
    implémenté en simulant son fonctionnement.
-   Ne supprime pas des réglages avancés pour simplifier
    artificiellement l'écran.
-   Ne cache pas les erreurs de sauvegarde, de calcul ou d'export.
-   Ne présente pas un ancien résultat comme à jour après modification
    de ses paramètres.
-   Ne perds pas les paramètres quand l'utilisateur revient en arrière.
-   Ne fais pas dépendre une action importante du survol de souris.
-   Ne considère pas qu'un layout desktop rétréci constitue une bonne
    interface mobile.
-   Ne change pas de framework ou de dépendances sans nécessité.
-   Ne modifie pas les tests pour qu'ils acceptent un comportement
    régressif.
-   Ne fais pas de commit, push ou déploiement sans instruction
    explicite de l'utilisateur.
-   Ne prétends pas avoir testé visuellement un écran si tu n'as pas pu
    le lancer ou l'inspecter.
-   Ne laisse pas un état incohérent simplement parce que le cas est
    rare : les suppressions, erreurs de calcul et changements de
    dimensions sont des cas importants.

------------------------------------------------------------------------

# 17. Compte rendu final obligatoire

À la fin, fournir un compte rendu structuré et concret.

## 17.1 Diagnostic initial

-   architecture et parcours observés ;
-   problèmes reproduits ;
-   fonctionnalités confirmées ;
-   fonctionnalités absentes ou incomplètes ;
-   risques principaux.

## 17.2 Modifications réalisées

Pour chaque changement important : - problème traité ; - comportement
avant ; - comportement après ; - fichiers ou composants concernés ; -
justification du choix ; - effet sur le parcours utilisateur.

## 17.3 Tests

Indiquer les commandes réellement exécutées et leurs résultats : - tests
unitaires/fonctionnels ; - tests E2E ; - build ; - lint/typecheck ; -
tests responsive ou inspection manuelle.

Séparer clairement : - réussi ; - échoué ; - non exécuté ; - bloqué par
l'environnement.

## 17.4 Points restant à traiter

Lister les problèmes qui n'ont pas été corrigés, en précisant : - leur
impact ; - leur priorité ; - pourquoi ils n'ont pas été traités ; - la
prochaine action recommandée.

## 17.5 Vérification de non-régression

Confirmer explicitement : - que les changements préexistants de
l'utilisateur ont été préservés ; - qu'aucun commit, push ou déploiement
n'a été fait sans autorisation ; - que les fonctionnalités existantes
utiles ont été conservées, ou détailler toute exception.

------------------------------------------------------------------------

# 18. Instructions de démarrage à exécuter maintenant

Commence par les actions suivantes, dans cet ordre :

1.  Inspecte l'état Git et repère les modifications locales à préserver.
2.  Lis le README et les instructions spécifiques au dépôt.
3.  Identifie le framework, les commandes disponibles et les tests.
4.  Cartographie les routes, les écrans et les composants du parcours
    projet → pièce → surface → revêtement → calepinage → résultats →
    export.
5.  Reproduis le parcours existant autant que l'environnement le permet.
6.  Compare le comportement actuel aux objectifs de ce document.
7.  Dresse une courte liste de problèmes classés P0 à P3.
8.  Corrige d'abord les problèmes bloquants et les pertes d'état.
9.  Implémente les améliorations UX par petits lots, en réutilisant les
    composants actuels.
10. Ajoute ou mets à jour les tests correspondant aux changements.
11. Lance les tests, le build et les vérifications disponibles.
12. Relis le diff pour détecter les changements hors périmètre.
13. Termine par le compte rendu structuré de la section 17.

**Décision importante :** en cas de doute entre une refonte ambitieuse
et une correction ciblée, choisis la correction ciblée tant qu'elle
permet d'atteindre le résultat UX. Si tu estimes qu'une refonte plus
profonde est réellement indispensable, démontre le problème à partir du
code et propose une migration progressive plutôt qu'un remplacement
brutal.

**Résultat final attendu :** PilePoil conserve son identité et ses
fonctionnalités utiles, mais le parcours devient plus évident, la vue
globale du projet sert de repère permanent, la sélection des surfaces
est directe et fiable, les paramètres sont conservés, les résultats
restent cohérents avec les données et l'export fonctionne sans
interrompre le travail.
