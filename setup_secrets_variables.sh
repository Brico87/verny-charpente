#!/usr/bin/env bash
# Configure tout d'un coup : secrets (depuis .env) et variables (définies ci-dessous).
#   1. déploie le Worker Cloudflare              4. définit les variables GitHub Actions (VARIABLES)
#   2. envoie ses secrets (Cloudflare)           5. autorise les Actions à créer des pull requests
#   3. envoie les secrets GitHub Actions         6. branche le webhook Telegram sur le Worker
#
#   cp .env.example .env   # remplir, puis :
#   ./setup_secrets_variables.sh
#
# DRY_RUN=1 ./setup_secrets_variables.sh   simule sans rien envoyer ni déployer.
# Relançable à volonté. Les valeurs passent par l'entrée standard (jamais dans la ligne de commande).
set -euo pipefail
cd "$(dirname "$0")"

REPO="Brico87/verny-charpente"
ENV_FILE="${ENV_FILE:-.env}"
[[ "$ENV_FILE" = /* ]] || ENV_FILE="$PWD/$ENV_FILE"   # chemin absolu : get() est aussi appelée depuis worker/
DRY_RUN="${DRY_RUN:-0}"
REQUIRED=(TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET GITHUB_TOKEN ALLOWED_USER_IDS TELEGRAM_CHAT_ID GEMINI_API_KEY GROQ_API_KEY)
WORKER_SECRETS=(TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET GITHUB_TOKEN ALLOWED_USER_IDS)
GITHUB_SECRETS=(TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID GEMINI_API_KEY GROQ_API_KEY MISTRAL_API_KEY OPENROUTER_API_KEY GOOGLE_PLACES_API_KEY GOOGLE_PLACE_ID)
# Variables non secrètes, lues par les workflows via ${{ vars.NOM }} : modifier ici puis relancer le script.
VARIABLES=(
  "GEMINI_MODEL=gemini-3.5-flash-lite"   # modèle Gemini (vision + rédaction) ; défaut du code si absent : gemini-2.5-flash
)

[[ -f "$ENV_FILE" ]] || { echo "✗ $ENV_FILE introuvable : cp .env.example .env puis remplir." >&2; exit 1; }

# Lit KEY=valeur dans .env sans l'exécuter (pas de "source")
get() {
  local line
  line=$(grep -E "^$1=" "$ENV_FILE" | tail -n1 || true)
  line="${line#*=}"; line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}
run() { if [[ "$DRY_RUN" == "1" ]]; then echo "  (simulation) $*"; else "$@"; fi; }

# 0. Vérifications
missing=()
for k in "${REQUIRED[@]}"; do [[ -n "$(get "$k")" ]] || missing+=("$k"); done
if ((${#missing[@]})); then echo "✗ Valeurs manquantes dans $ENV_FILE : ${missing[*]}" >&2; exit 1; fi
if [[ "$DRY_RUN" != "1" ]]; then
  (cd worker && npx wrangler whoami >/dev/null 2>&1) || { echo "▶ Connexion à Cloudflare…"; (cd worker && npx wrangler login); }
  gh auth status >/dev/null 2>&1 || { echo "▶ Connexion à GitHub…"; gh auth login; }
fi
grep -q REMPLACER_PAR worker/wrangler.toml && { echo "✗ worker/wrangler.toml : renseigner l'id KV (cd worker && npx wrangler kv namespace create STATE)." >&2; exit 1; }

# 1. Déploiement du Worker (crée le Worker, nécessaire avant d'y mettre des secrets)
echo "▶ 1/6 Déploiement du Worker Cloudflare"
URL="$(get WORKER_URL)"; URL="${URL%/}"; URL="${URL%/telegram}"   # tolère l'URL complète du webhook
if [[ "$DRY_RUN" == "1" ]]; then echo "  (simulation) wrangler deploy"; URL="${URL:-https://verny-telegram.example.workers.dev}"
else
  out=$(cd worker && npx wrangler deploy 2>&1) || { echo "$out" >&2; exit 1; }
  # WORKER_URL (.env) prioritaire ; sinon URL lue dans la sortie de wrangler
  [[ -n "$URL" ]] || URL=$(printf '%s' "$out" | grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' | head -1 || true)
  [[ -n "$URL" ]] || { echo "$out" >&2; echo "✗ URL du Worker introuvable : la renseigner dans WORKER_URL (.env)." >&2; exit 1; }
fi
[[ "$URL" =~ ^https://[^/]+$ ]] || { echo "✗ WORKER_URL invalide : $URL (attendu https://<hôte>, sans chemin)." >&2; exit 1; }
echo "  ✓ $URL"

# 2. Secrets du Worker
echo "▶ 2/6 Secrets du Worker Cloudflare"
for name in "${WORKER_SECRETS[@]}"; do
  if [[ "$DRY_RUN" == "1" ]]; then echo "  ✓ $name (simulation)"; continue; fi
  value="$(get "$name")"   # lu avant le cd worker
  [[ -n "$value" ]] || { echo "  ✗ $name vide" >&2; exit 1; }
  (cd worker && printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null) && echo "  ✓ $name"
done

# 3. Secrets GitHub Actions
echo "▶ 3/6 Secrets GitHub Actions ($REPO)"
for name in "${GITHUB_SECRETS[@]}"; do
  value="$(get "$name")"
  if [[ -z "$value" ]]; then echo "  – $name : vide, ignoré"; continue; fi
  if [[ "$DRY_RUN" == "1" ]]; then echo "  ✓ $name (simulation)"; continue; fi
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO" >/dev/null && echo "  ✓ $name"
done

# 4. Variables GitHub Actions
echo "▶ 4/6 Variables GitHub Actions ($REPO)"
for entry in "${VARIABLES[@]}"; do
  name="${entry%%=*}"; value="${entry#*=}"
  if [[ "$DRY_RUN" == "1" ]]; then echo "  ✓ $name=$value (simulation)"; continue; fi
  gh variable set "$name" --repo "$REPO" --body "$value" >/dev/null && echo "  ✓ $name=$value"
done

# 5. Réglage du dépôt : les Actions peuvent créer des pull requests
echo "▶ 5/6 Autoriser les Actions à créer des pull requests"
if [[ "$DRY_RUN" == "1" ]]; then echo "  (simulation)"
else
  gh api -X PUT "repos/$REPO/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true >/dev/null \
    && echo "  ✓ activé" || echo "  ⚠ échec : le faire à la main (Settings → Actions → General → Allow GitHub Actions to create and approve pull requests)"
fi

# 6. Webhook Telegram (le token est lu sur stdin pour ne pas apparaître dans la liste des processus)
echo "▶ 6/6 Webhook Telegram → $URL/telegram"
if [[ "$DRY_RUN" == "1" ]]; then echo "  (simulation)"
else
  printf 'url = "https://api.telegram.org/bot%s/setWebhook"\n' "$(get TELEGRAM_BOT_TOKEN)" | curl -sS -K - \
    --data-urlencode "url=$URL/telegram" --data-urlencode "secret_token=$(get TELEGRAM_WEBHOOK_SECRET)" \
    --data-urlencode 'allowed_updates=["message","callback_query"]'
  echo
fi
echo "✓ Terminé. Envoyer /start au bot sur Telegram pour tester."
