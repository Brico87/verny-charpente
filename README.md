# Verny Charpente — site démo (Astro)

- `npm install && npm run dev`
- Contacts et avis Google : récupérés au build par `scripts/fetch-google.mjs` (Places API) si les secrets
  `GOOGLE_PLACES_API_KEY` et `GOOGLE_PLACE_ID` sont définis dans GitHub → Settings → Secrets → Actions.
- Coordonnées de repli : `src/data/business.json`.
- Déploiement : GitHub Pages via `.github/workflows/deploy.yml` (Settings → Pages → Source : GitHub Actions).
