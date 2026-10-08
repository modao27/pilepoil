# Pilepoil

Boîte à outils de rénovation en PWA : plan des pièces commun, calepinage du carrelage (zones et motifs, coupes,
réemploi des chutes, plans PDF, rendu 2D et 3D), bibliothèques de carreaux et de lames, liste d'achat consolidée
du projet. Le module parquet arrive ensuite. Installable, fonctionne hors ligne ; les projets restent sur
l'appareil. Anciennement « Calepinage ».

## Commandes
| Commande | Rôle |
|---|---|
| `npm run dev` | Développement (service worker désactivé) |
| `npm run check` | Types, lint, tests unitaires et de parité — avant chaque commit |
| `npm run build` / `npm run preview` | Build de production et aperçu sur http://localhost:4173 |
| `npm run test:e2e` | Parcours Playwright, téléphone 390 px et ordinateur, captures dans `screenshots/` |
| `npm run lighthouse` | Audit Lighthouse du build (rapports dans `reports/lighthouse/`) |
| `npm run release` | Tout ce qui précède, avant une mise en ligne |
| `npm run icons` | Régénère les icônes depuis `src/pwa/icon.ts` |

## Documentation
- `CLAUDE.md` : contexte permanent (pile, architecture, conventions)
- `docs/BOITE.md` : architecture de la boîte à outils (modules, plan commun, modèle v2, achats)
- `docs/PLAN.md` : phases en cours et critères de validation ; `docs/PROMPTS.md` : consignes par phase
- `docs/UX.md` : écrans, interactions, système de design
- `docs/MODEL.md` : modèle de données v1 et stockage
- `docs/DEPLOY.md` : mise en ligne statique
- `docs/carrelage/` : règles métier et historique du module carrelage
- `docs/parquet/SPEC.md` : spécification du module parquet
- `legacy/calepinage.html` : ancienne version, référence fonctionnelle du carrelage
