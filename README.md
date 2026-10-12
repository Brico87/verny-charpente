# Verny Charpente — site démo (Astro)

- `npm install && npm run dev`
- Contacts et avis Google : récupérés au build par `scripts/fetch-google.mjs` (Places API) si les secrets
  `GOOGLE_PLACES_API_KEY` et `GOOGLE_PLACE_ID` sont définis dans GitHub → Settings → Secrets → Actions.
- Coordonnées de repli : `src/data/business.json`.
- Déploiement : GitHub Pages via `.github/workflows/deploy.yml` (Settings → Pages → Source : GitHub Actions).

## Réalisations et conseils (blog)

- `src/content/chantiers/*.md` : réalisations (photos dans `public/images/chantiers/<slug>/`) → page `/realisations/`.
- `src/content/blog/*.md` : articles de conseils → page `/blog/`.  Rédigés uniquement à la demande (`/sujet <idée>` sur Telegram).
- Les fichiers sont normalement **générés par le bot Telegram** et validés par pull request : voir [docs/telegram-setup.md](docs/telegram-setup.md).
  On peut aussi les écrire à la main (champs : voir `src/content.config.ts` ; `draft: true` pour masquer).
- Plan d'ensemble (hébergement, SEO local, GEO, transfert au client) : [docs/architecture.md](docs/architecture.md).
