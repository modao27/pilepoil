# Audit UI/UX — progression

Branche : `audit/ui-ux`. Règles : ne rien modifier dans `src/`, ne rien corriger ; commits limités à `tests/audit/`,
`docs/audit/`, `playwright.audit.config.ts` et au script `npm run test:audit`.

## Étape en cours
**Terminée le 2026-10-17** : matrice complète passée (2 581 exécutions), 51 constats, rapport, matrice de couverture,
propositions. Reste : attendre les choix de l'utilisateur sur `PROPOSITIONS.md` ; rien n'est mis en œuvre.

## Corrections
- Lot A (branche `lot-a-projets`, 2026-10-17) : PRJ-01, PRJ-02, PRJ-03, UX-04, NOU-01 corrigés.
- Lot C (branche `lot-c-achats`, 2026-10-17) : ACH-01, CAR-01, PAR-01, ACH-02, ROB-03 corrigés.

## Étapes
- [x] 0. Cartographie (routes, actions, implémenté / absent, 89 scénarios, matrice)
- [x] 1. Matrice : `playwright.audit.config.ts` (29 projets, 5 workers), script `npm run test:audit`, navigateurs
- [x] 2a. Scénarios A à N écrits (`tests/audit/*.spec.ts`), verts sur 390 Chromium et 1280 Chromium
- [x] 2b. Passage complet sur les 29 appareils (lancé, log : `docs/audit/captures-local/run-complet.log` ; ensuite
      `npx playwright test -c playwright.audit.config.ts --last-failed` puis `npx tsx tests/audit/aggregate.ts`)
- [x] 3a. Analyse sur les appareils de référence ; constats saisis dans `tests/audit/constats.ts`
      (`npx tsx tests/audit/constats.ts` → `constats.csv`, `CONSTATS.md`)
- [x] 4a. `A_TESTER_SUR_TELEPHONE.md`
- [x] 4b. `RAPPORT.md` (brouillon complet, couverture à compléter), `PROPOSITIONS.md` (étape 5, maquettes dans
      `maquettes/`)
- [x] 3b. À la fin de la matrice : `--last-failed`, `npx tsx tests/audit/aggregate.ts`, lire `mesures/couverture.md`,
      `controles.md`, `echecs.md` ; regarder les captures paysage, tablettes, Firefox, WebKit (`captures-local/<écran>/`)
      ; ajouter les constats propres à ces appareils dans `tests/audit/constats.ts` et régénérer
- [x] 4c. `MATRICE.md` (couverture réelle + non testé), chiffres de la synthèse de `RAPPORT.md` mis à jour, captures de
      preuve hors référence copiées dans `captures/`, commit
- [x] Fin : résumé en 10 lignes (couverture, constats par gravité, 5 actions, non testé), attendre les choix
- [ ] 3. Analyse des captures (Nielsen, UX.md, identité, WCAG 2.2, mobile, textes, parcours, métier)
- [ ] 4. Rapport : `RAPPORT.md`, `constats.csv`, `MATRICE.md`, `A_TESTER_SUR_TELEPHONE.md`
- [ ] 5. `PROPOSITIONS.md` (corrections par lots, améliorations, fonctionnalités, classement)

## Décisions de la session
2026-10-16 :
- étape 0 validée ;
- WebKit et Firefox installés pour Playwright (`npx playwright install webkit firefox`) ;
- **tout partout** : les 89 scénarios sur les 29 projets (pas de paliers) ; ce qui n'a pas de sens sur un moteur
  (Lighthouse hors Chromium, CDP réseau/CPU hors Chromium) est sauté et noté dans `MATRICE.md` ;
- captures commitées : celles citées par un constat, plus une par écran sur les deux appareils de référence
  (390 Chromium, 1280 Chromium), en JPEG ; les autres dans `docs/audit/captures-local/` (ignoré par git).
- matrice complète gardée malgré sa durée (12 à 16 h estimées, 5 workers, mémoire saturée au-delà) ; rapport rédigé
  pendant le passage puis complété.

## Constats confirmés en test (brouillon, à reprendre dans constats.csv)
- B6 : projet sans carrelage → aucune action (renommer, dupliquer, supprimer) sur l'accueil ; aucun autre écran ne
  supprime un projet.
- B5 : suppression sans confirmation, annulable 6,5 s ; onglet fermé pendant ce délai → projet revenu.
- B2 : dessin libre au toucher (Chromium et WebKit) : toucher le premier point ne ferme pas la pièce (la souris, si) ;
  cause probable : clic fantôme sur le fond de la fenêtre « Nommer la pièce » ouverte au pointerup
  (`src/ui/plan/PlanCanvas.svelte:213`, `planState.svelte.ts:471`). Contournement : « Terminer la pièce ».
- B7 : projet au nom vide → carte sans nom, lien sans nom accessible ; pas de recherche ni de tri.
- B3 : renommer en vide / espaces : bouton actif, rien ne se passe, aucun message.
- B1 : « Annuler » dans « Nouveau projet » laisse un éditeur de plan vide sur #/new.
- Achats : rails et montants des cloisons sans quantité (« Cloisons · »).
- Calepinage d'une pose : barre de résumé = totaux de tout le carrelage du projet (1171 carreaux pour un sol de 6,7 m²).
- Accueil : carte d'un projet mixte = chiffres du carrelage seul (21,96 m²) ; vue globale : 23,42 m² ; vignette = 1re
  surface carrelée (une crédence), pas le plan.
- Pièce : liste « Sol et murs » : « Pose 2, Pose 3 » sans le nom du revêtement ; boutons sans aspect de bouton.
- Plan : libellé « Salle de bain » qui déborde de la pièce ; calque « État des lieux » (docs : « Existant »).
- Partition : pièce créée nommée « Séjour (2) » sans proposition de nom.
- Ajouter une pièce en U : message « Le retrait doit rester plus petit » (le U n'a pas de « retrait »).

## Constats relevés en lisant le code (à confirmer en test)
- Accueil : menu Renommer / Dupliquer / Supprimer seulement sur un projet avec carrelage (`src/ui/screens/Home.svelte:12`).
- Accueil vide : lien « Importez vos données » vers Réglages, où l'import n'existe plus (retiré en C4).
- Suppression d'un projet : effacée de la base après 6,5 s par un `setTimeout` ; si l'onglet se ferme avant, le
  projet revient (`src/ui/lib/app.svelte.ts:161`) — à vérifier.
- Plan : Suppr / Retour arrière supprime une pièce sélectionnée ; confirmation à vérifier (`src/ui/plan/PlanCanvas.svelte:289`).
- Saisie « 2,4 m » non comprise (`src/ui/lib/calc.ts`).
- Réglages « À propos » ne cite que le carrelage.
