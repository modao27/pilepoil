# PilePoil — identité visuelle 1.0

« Vos travaux, au millimètre près. »

Ouvrir `docs/identite-charte.html` pour voir l'ensemble (logo, couleurs, typo, icônes, composants).

## Contenu
| Dossier | Contenu |
|---|---|
| `logo/vertical/` | Logo principal vertical avec accroche — 5 versions |
| `logo/horizontal/` | Logo horizontal, avec et sans accroche — 5 versions chacun |
| `logo/symbole/` | Symbole seul — 5 versions |
| `app/` | Icône squircle, icône pleine, maskable, favicon, image de partage (SVG sources) |
| `pwa/` | PNG prêts pour la PWA, favicon.ico/svg, apple-touch, og-image, extraits manifeste et `<head>` |
| `png/` | Logos en PNG haute définition (en-tête PDF jsPDF, documents) |
| `icones/` | 32 icônes 24 × 24 (`metiers/`, `actions/`), `sprite.svg`, `icons.ts`, icônes de module 34 × 24 |
| `tokens/` | `tokens.css` (clair + sombre), `tokens.json`, `brand.ts` (jsPDF, three.js) |
| `typo/` | `typo.css` : polices et échelle typographique |

Versions de couleur : `couleur`, `mono-noir`, `mono-blanc`, `inverse-petrole`, `inverse-terracotta`.

## Intégration dans le dépôt
- `pwa/*` et `app/favicon.svg` → `public/`
Référence : `src/ui/design/identite/` (ne pas modifier, exclue de Prettier, ESLint et tsc).
- `tokens/tokens.css`, `typo/typo.css` → `src/ui/design/`, importés une fois par `base.css`
- `tokens/brand.ts` → `src/ui/brand.ts` (PDF et 3D)
- `icones/icons.ts` → `src/ui/icons.ts` ; `icones/modules/*-34x24.svg` → champ `icon` de chaque `ToolModule`
- `png/pilepoil-horizontal-couleur@4x.png` → en-tête des PDF (`ui/lib/pdf.ts`), à 36 mm de large environ
- Polices : `npm i @fontsource-variable/manrope @fontsource-variable/inter` (OFL 1.1, hors ligne)

## Points d'attention
- **Contraste** : terracotta (2,8:1) et ocre (2,1:1) échouent au AA sur ivoire. Texte, messages d'erreur,
  boutons à bordure terracotta : utiliser `--pp-terracotta-texte` (#A4502F) ou `--pp-ocre-texte` (#7E6020).
- **Inversé terracotta** : ivoire sur terracotta = 2,8:1, sous le seuil de 3:1 pour les graphiques.
  À réserver aux grands formats (couverture, kakémono). Partout ailleurs, préférer l'inversé pétrole.
- **Wordmark** : dessiné en tracés, sans police. L'accroche reste du texte en Inter : elle s'affiche dans
  la police de secours si Inter n'est pas chargée (cas des PNG générés ici). Régénérer les PNG avec accroche
  une fois Inter installée, ou vectoriser l'accroche dans Figma.
- **Saisie** : champs en 16 px minimum, sinon Safari iOS zoome au focus.
