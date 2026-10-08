# Calepinage

PWA de calepinage carrelage : zones et motifs, coupes, réemploi des chutes, quantités, liste d'achat, plans PDF,
rendu 2D et 3D. Installable, fonctionne hors ligne ; les projets restent sur l'appareil.

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
- `docs/PLAN.md` : phases et critères de validation ; `docs/PROMPTS.md` : consignes par phase
- `docs/DOMAIN.md` : règles métier et invariants
- `docs/UX.md` : écrans, interactions, système de design
- `docs/MODEL.md` : modèle de données et stockage
- `docs/DEPLOY.md` : mise en ligne statique
- `legacy/calepinage.html` : ancienne version, référence fonctionnelle
