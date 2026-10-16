# Matrice de couverture

Passage complet du 16 au 17 octobre 2026 : 89 scénarios × 29 appareils = 2 581 exécutions (2 610 tests Playwright avec
les jeux de données). Détail cellule par cellule : [`mesures/couverture.md`](mesures/couverture.md) ; contrôles
automatiques par écran : [`mesures/controles.md`](mesures/controles.md) ; étapes en échec :
[`mesures/echecs.md`](mesures/echecs.md) ; performance : [`mesures/performance.md`](mesures/performance.md).

## Appareils (29)

| Famille | Appareils | Moteur |
|---|---|---|
| Téléphones (16) | 360 × 740, 375 × 667, 390 × 844, 430 × 932, portrait et paysage | Chromium (Pixel 7) et WebKit (iPhone 13), tactile |
| Tablettes (4) | 768 × 1024 et 1024 × 1366, portrait et paysage | WebKit (iPad Pro 11), tactile |
| Ordinateurs (9) | 1280 × 800, 1440 × 900, 1920 × 1080 | Chromium, Firefox, WebKit |

Conditions couvertes : thème clair et sombre (tour des écrans N1), mouvement réduit (N4), zoom 200 % et texte à 200 %
(N3), hors ligne (A3), réseau 3G lent et processeur ×4 (L11, Chromium), clavier seul (N2), langue `fr-FR`, fuseau
Europe/Paris.

## Résultat

| État | Exécutions | Sens |
|---|---|---|
| ok | 2 440 | scénario au bout, sans étape en échec |
| ~n | 85 | n étapes en échec : limite du test ou constat (voir ci-dessous) |
| sans objet | 36 | émulation réseau/processeur (L11) et Lighthouse (M3) : Chromium seulement |
| délai | 16 | dépassement du délai du test (WebKit, grands écrans, machine chargée) |
| KO | 4 | I1 : capture pleine page impossible (> 32 767 px) |

Après relance avec un délai de 5 min (A3, E3, F1, F2, G2, G4, H1, I1 sur quatre appareils représentatifs) : tout passe,
sauf A3 sur téléphone WebKit et la capture d'I1 sur téléphone WebKit.

## Cellules qui ne sont pas « ok », et pourquoi

| Scénario | Appareils | Cause |
|---|---|---|
| A3 hors ligne | 6 téléphones WebKit en délai ; 8 étapes en échec sur WebKit, 1 sur Chromium et Firefox | Sous WebKit, la navigation hors ligne échoue (« WebKit encountered an internal error ») : l'émulation hors ligne de Playwright ne sert pas le service worker. **Non testé sous WebKit** : à vérifier sur un iPhone. L'étape en échec sur Chromium et Firefox est « calepinage » : le test attend un titre h1 que cet écran n'a pas (constat A11Y-01) ; accueil, projet, pièce, résultats, achats, réglages et le PDF fonctionnent hors ligne. |
| B2 dessin libre | 12 téléphones et tablettes | Étape « Créer la pièce » : fermeture du dessin au toucher (constat PLAN-03). |
| C6 ouvertures | tous (29) | Étape « porte hors mur » : le panneau du plan n'est plus trouvé après le clic forcé sur la porte (la valeur limite est vue dans C5 et C14). Limite du test, non investiguée plus loin. |
| C7, C13 | 3 et 6 appareils | Étapes « supprimer le passage » et « démolir » : panneau du plan non trouvé (replié ou clic sur la cible SVG). Limite du test, non investiguée plus loin ; chemins vus sur les appareils de référence. |
| D4 découpe du sol | 12 téléphones | Étape « contour » : « Fermer le contour » ou « Découper par un contour » introuvable après les touchers de test. Probable chute des points sur un mur déplié (constat PIE-01), non confirmé appareil par appareil. |
| F1 motifs du parquet | 4 (WebKit, grands écrans) | Délai : 7 motifs × recalculs en 3D logicielle. Repasse après relance. |
| I1 résultats | 4 téléphones WebKit | Capture pleine page > 32 767 px (hauteur de page 11 300 px × densité ×3) : limite de Playwright, constat UX-05. |
| N1 tour des écrans | 6 grands écrans WebKit | Délai de 10 min (33 écrans × 2 thèmes en rendu logiciel). Les relevés des écrans atteints sont gardés. |
| N4 mouvement réduit | ordinateur 1920 × 1080 WebKit | Bloqué, arrêté à la main ; relevé éventuellement incomplet. Les 28 autres appareils sont complets. |

## Ce qui n'a pas pu être testé, et pourquoi

| Sujet | Raison | Où le vérifier |
|---|---|---|
| Installation réelle (Android, iPhone), icône, écran de démarrage, mode installé | Aucune installation possible en émulation ; seuls le manifeste, les icônes et la capacité d'installation (Chromium) sont contrôlés. | A_TESTER_SUR_TELEPHONE.md |
| Safari iOS : zoom automatique au focus des champs, clavier virtuel qui masque un champ, encoche, barre d'accueil, `100dvh` | WebKit sous Windows n'est pas Safari iOS ; seul le calcul de la taille des champs est mesuré (UI-01). | A_TESTER_SUR_TELEPHONE.md |
| Plein soleil, gants, une main, poussière | Conditions physiques. | A_TESTER_SUR_TELEPHONE.md |
| Performances réelles d'un téléphone (3D, optimisation, PDF) | Le PC exécute l'émulation ; rendu 3D logiciel. Valeurs relatives seulement. | A_TESTER_SUR_TELEPHONE.md |
| Appareil photo | Pas de caméra : « Choisir une photo » seulement ; l'application n'a pas de capture. | A_TESTER_SUR_TELEPHONE.md |
| Pincer pour zoomer sous WebKit | Playwright ne simule le multi-touch que sous Chromium (CDP) ; testé sur les 12 téléphones Chromium. | iPhone réel |
| Retour Android | Simulé par `history.back()` (L3). | Android réel |
| Lighthouse sous Firefox et WebKit | Lighthouse ne fonctionne que sur Chromium ; fait sur 18 appareils Chromium. | — |
| Réseau lent et processeur ralenti hors Chromium | Émulation par CDP, Chromium seulement. | — |
| Import de l'ancienne application, migration v1 → v2 | Retirés du code en C4 : rien à tester. Seul reste un lien mort sur l'accueil vide (UX-04). | — |
| Mode chantier | Retiré le 2026-10-15 (`docs/PLAN.md`). | — |
| Plafonds, synchronisation entre appareils, recherche et tri des projets | N'existent pas. | PROPOSITIONS.md |
| Reconstitution de documents réels de clients | Aucun document réel fourni : un jeu « maison » créé par le parcours normal a servi. | — |
| Ancien favori / ancienne adresse | Seule la redirection `…/m/<module>/results` existe ; testée en L4. | — |

## Lecture des échecs d'étape

Les scénarios relèvent leurs échecs au lieu de s'arrêter : un « ~n » n'est pas un constat en soi. Chaque ligne
`échec:<étape>` de `mesures/echecs.md` a été comparée aux captures `echecs/` avant d'être classée en constat ou en
limite du test (tableau ci-dessus).
