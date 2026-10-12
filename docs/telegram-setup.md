# Mise en place du bot Telegram

Implémente les sections 2 et 3 de [architecture.md](architecture.md) : photos et notes envoyées à un bot Telegram
→ Cloudflare Worker → GitHub Actions → brouillon en pull request → validation par boutons.

```
Telegram ──webhook──▶ Worker (worker/) ──repository_dispatch──▶ GitHub Actions
   ▲   boutons ✅ ✏️ ❌ ◀── scripts/notify.mjs ◀── PR (brouillon)   chantier.yml / blog.yml
   └── Publier = le Worker fusionne la PR → deploy.yml publie le site
```

## Utilisation (côté artisan)

| J'envoie au bot | Résultat |
|---|---|
| 1 à 8 photos + légende ou vocal ("Réfection toiture ardoise à Vannes, 3 semaines") | Fiche chantier en brouillon, aperçu avec boutons |
| `/sujet Isolation des combles` | Article de blog en brouillon sur ce sujet (uniquement à la demande, aucune publication automatique) |

Boutons : **✅ Publier** (fusionne la PR, le site se déploie) · **✏️ Corriger** (répondre par texte ou vocal, nouvel aperçu) · **❌ Annuler** (ferme la PR).

> Utilisez une **conversation privée avec le bot** (ou un groupe où le bot est membre), pas un « canal » Telegram :
> un canal est à sens unique et les boutons de validation n'y fonctionnent pas comme prévu.

## Installation (une seule fois)

### 1. Bot Telegram
1. Sur Telegram, écrire à **@BotFather** → `/newbot` → noter le **token** (secret).
2. Récupérer l'identifiant Telegram de chaque personne autorisée à publier (par ex. via **@userinfobot**) → `ALLOWED_USER_IDS` (séparés par des virgules).
3. Récupérer l'identifiant de la conversation qui reçoit l'aperçu des articles lancés manuellement depuis GitHub (Actions → *Article de blog* → Run workflow) → `TELEGRAM_CHAT_ID` (pour une conversation privée, c'est l'identifiant de l'utilisateur).

### 2. Jeton GitHub (utilisé par le Worker)
GitHub → Settings → Developer settings → **Fine-grained token**, limité au dépôt, avec **Contents : Read and write** et **Pull requests : Read and write**
(Contents sert au `repository_dispatch` et à la suppression de branche).
Le fusionnement par ce jeton déclenche bien `deploy.yml`, contrairement à une fusion faite avec le `GITHUB_TOKEN` d'une Action.

Réglage du dépôt : Settings → Actions → General → **Allow GitHub Actions to create and approve pull requests**.

### 3. Clés des LLM gratuits
| Secret | Où l'obtenir | Rôle |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio | vision + rédaction |
| `GROQ_API_KEY` | console.groq.com | transcription des vocaux (Whisper) + rédaction de secours |
| `MISTRAL_API_KEY` | console.mistral.ai | secours (facultatif) |
| `OPENROUTER_API_KEY` | openrouter.ai | dernier recours (facultatif) |

### 4. Secrets du dépôt (Settings → Secrets and variables → Actions)
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GEMINI_API_KEY`, `GROQ_API_KEY`, et si utilisés `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`.

### 5. Worker Cloudflare
```bash
cd worker
npx wrangler kv namespace create STATE        # coller l'id obtenu dans wrangler.toml
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # chaîne aléatoire de votre choix
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ALLOWED_USER_IDS
npx wrangler deploy                             # affiche l'URL du Worker
```

### 6. Brancher le webhook Telegram
Remplacer les valeurs entre chevrons (ne jamais coller le token dans un fichier du dépôt) :
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<votre-worker>.workers.dev/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","callback_query"]'
```

### 7. Tester
Envoyer `/start` au bot, puis une photo avec une légende. Compter 20 secondes (regroupement des photos), puis 1 à 3 minutes (Actions).

## Sécurité
- Le Worker vérifie l'en-tête `X-Telegram-Bot-Api-Secret-Token` et ignore tout utilisateur absent de `ALLOWED_USER_IDS`.
- Les photos passent par `sharp` : rotation selon l'EXIF puis **suppression de toutes les métadonnées** (GPS compris) avant publication.
- Rien n'est publié sans clic sur ✅ : tout passe par une pull request.
- Les textes sont rédigés par un LLM : **relire** avant de publier (aucun prix, durée, garantie ou certification ne doit être inventé).

## Limites connues
- Le pipeline complet n'a pas été testé avec de vrais comptes : le Worker et les scripts ont été testés avec des simulations (Telegram, GitHub, LLM).
- Quotas des offres gratuites des LLM : variables ; la chaîne de repli passe au fournisseur suivant en cas d'erreur.
- Une pull request créée par une Action ne lance pas les workflows de test éventuels (limite GitHub) ; sans incidence ici, le déploiement part à la fusion.
