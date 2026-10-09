# Prompts à coller dans Claude Code

Lancer Claude Code à la racine du dépôt. Une session par phase : faire `/clear` entre deux phases.
Commencer chaque phase en mode plan (Maj+Tab), valider le plan, puis laisser coder.

## Démarrage (une seule fois)
```
Lis CLAUDE.md, docs/BOITE.md, docs/PLAN.md et docs/parquet/SPEC.md.
On transforme l'application carrelage en boîte à outils de rénovation, puis on ajoute le module parquet.
Ne code rien pour l'instant. Fais-moi un état des lieux :
1. ce qui dans src/ est propre au carrelage et ce qui doit devenir partagé, fichier par fichier ;
2. les points des documents qui te semblent flous, contradictoires ou risqués par rapport au code actuel ;
3. ta proposition de découpage de la phase S1 en commits.
```

## S1 — Restructuration en modules
```
Réalise la phase S1 de docs/PLAN.md sur une branche phase/s1-modules.
Commence par écrire src/modules/types.ts (contrat de docs/BOITE.md §2) et montre-le-moi.
Ensuite déplace le code carrelage avec git mv, un commit par groupe de fichiers, en lançant
npm run check à chaque étape. La parité doit rester à 100 % : si un test de parité casse, arrête-toi
et explique pourquoi avant de corriger.
Termine par le worker aiguillé par module, les routes préfixées et les redirections, puis npm run test:e2e.
```

## S2 — Modèle v2 et plan commun
```
Réalise la phase S2 de docs/PLAN.md sur une branche phase/s2-plan.
Ordre : 1) core/plan (types, validation, réducteur, tests) ; 2) core/geometry/boolean.ts : compare deux
bibliothèques (clipper2-js, polygon-clipping) sur taille, robustesse et fonctionnement en worker, propose-moi
ton choix avant de l'installer ; 3) modèle v2, migration v1→v2 et version IndexedDB, avec documents figés
en test ; 4) écran Projet et éditeur de plan.
Vérifie l'éditeur de plan avec Playwright en 390 px et en desktop, captures à l'appui.
```

## S3 — Achats consolidés et bibliothèques
```
Réalise la phase S3 de docs/PLAN.md sur une branche phase/s3-achats.
Écris d'abord un test qui prouve que la liste d'achat consolidée d'un projet carrelage est identique à
l'actuelle (mêmes articles, quantités, prix), puis l'adaptateur et l'écran Achats.
Ensuite les bibliothèques séparées et le formulaire de lame.
Le nom de l'application est : Pilepoil. Applique le renommage complet décrit dans docs/PLAN.md S3
(manifeste, titre, icônes, base IndexedDB avec copie depuis « calepinage », page de redirection à
l'ancienne adresse). Demande-moi confirmation avant de renommer le dépôt GitHub.
```

## P1 — Parquet : données et pose droite
```
Réalise la phase P1 de docs/PLAN.md sur une branche phase/p1-parquet-droit, selon docs/parquet/SPEC.md.
Commence par les types (ParquetData, Board, ParquetSpec, ParquetResult) et les valeurs par défaut,
montre-les-moi. Ensuite le moteur, en écrivant d'abord les tests des cas R1, R2, R3, R4, R6, R9 :
pour R1 à R3, détaille le calcul attendu en commentaire du test avant d'écrire le code.
Ajoute les tests de propriétés (fast-check) sur les invariants du §4.7.
Enfin l'éditeur minimal. Mesure le temps de calcul sur 30 m².
```

## P2 — Bâton rompu et point de Hongrie
```
Réalise la phase P2 de docs/PLAN.md sur une branche phase/p2-motifs.
Étape 1 : déplace herring et chevron dans src/core/patterns/ sans changer leur comportement ;
la parité carrelage doit rester à 100 %, commit séparé.
Étape 2 : Hongrie à 60°, variantes A/B, placement de l'axe, découpage, réemploi des chutes en 2D.
Montre-moi un rendu SVG de R5 et d'une pièce en L en point de Hongrie à 45° avant de passer à l'interface.
```

## P3 — Plusieurs pièces et fractionnement
```
Réalise la phase P3 de docs/PLAN.md sur une branche phase/p3-multi-pieces.
Tests R7 et R8 d'abord. Vérifie visuellement la continuité des rangs à travers une porte (capture SVG).
```

## P4 — Optimisation, plinthes, résultats
```
Réalise la phase P4 de docs/PLAN.md sur une branche phase/p4-resultats.
Ordre : optimisation (tranches annulables, progression), core/cutting/bars.ts générique avec tests,
plinthes, lignes d'achat, écran Résultats, fiche de coupe, export PDF.
Génère le PDF de R7 et montre-moi chaque page en image.
```

## P5 — 3D, chantier, finitions
```
Réalise la phase P5 de docs/PLAN.md sur une branche phase/p5-3d-chantier.
3D en réutilisant render/scene3d, puis mode chantier hors ligne. Ajoute le parcours e2e complet
du §P5, lance npm run release et corrige jusqu'à ce que tout passe.
```

## C1 — Moteur du carrelage : surfaces de forme quelconque
```
Réalise la phase C1 de docs/PLAN.md sur une branche phase/c1-moteur.
Contour facultatif dans SurfaceSpec ; sans contour, rien ne change (parité verte à chaque commit).
Montre-moi un rendu SVG d'un sol en L avec poteau avant de fusionner.
```

## C2 — Modèle et état du carrelage sur le plan
```
Réalise la phase C2 de docs/PLAN.md sur une branche phase/c2-modele.
Montre-moi les nouveaux types des données du carrelage avant de modifier l'état.
```

## C3 — Interface du carrelage sur le plan
```
Réalise la phase C3 de docs/PLAN.md sur une branche phase/c3-interface.
Termine par le parcours e2e « pièce en L → sol et deux murs → achats » et npm run release.
```

## C4 — Nettoyage
```
Réalise la phase C4 de docs/PLAN.md sur une branche phase/c4-nettoyage : retire les anciens formats,
mets la documentation à jour, lance npm run release.
```

## N0 à N5 — Parcours centré sur le projet
```
Lis docs/NAVIGATION.md, puis réalise la phase N<k> de docs/PLAN.md sur une branche phase/n<k>-<nom>.
Montre le plan (fichiers, types, étapes) avant de coder. Distingue ce qui existe de ce qui est à créer.
```

## En cours de route

Reprise après une interruption :
```
Relis CLAUDE.md et la phase <X> de docs/PLAN.md. Regarde git log et git status sur la branche en cours,
dis-moi où on en est par rapport aux critères de fin, puis continue.
```

Revue avant fusion :
```
Fais la revue de la branche en cours par rapport à main : respect de CLAUDE.md (un module n'importe pas un
autre, core sans DOM, unités en mm, textes en français), critères de fin de la phase, tests manquants,
code mort. Liste les problèmes par gravité, corrige ce qui est sûr, demande-moi pour le reste.
```

Décision qui change la spec :
```
On change <règle>. Mets à jour docs/parquet/SPEC.md (ou docs/BOITE.md) dans le même commit que le code,
avec la date et la raison, comme pour l'évolution du 2026-10-07 dans docs/carrelage/DOMAIN.md.
```
