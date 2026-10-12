# Site statique charpentier/zingueur : architecture, automatisation et stratégie SEO/GEO

**Recommandation en bref :** Astro sur GitHub Pages, un bot Telegram relayé par un Cloudflare Worker gratuit, et des pull requests GitHub qui servent de brouillons à valider. Le seul coût récurrent est le nom de domaine, environ 10 à 15 € par an.

---

## 1. Choix techniques

### Hébergement : GitHub Pages plutôt que Vercel

Le plan gratuit de Vercel (Hobby) est réservé à un usage non commercial. Un site d'entreprise y viole donc les conditions d'utilisation. GitHub Pages convient pour un site vitrine. Cloudflare Pages reste une alternative gratuite, autorisée en usage commercial et avec une bande passante illimitée.

### Générateur de site : Astro

Astro apporte les *content collections* (chantiers et articles en Markdown typé), l'optimisation automatique des images en AVIF/WebP, le sitemap et un JavaScript quasi nul. Le score Lighthouse se situe autour de 100 sans effort.

### Le Cloudflare Worker, pivot du système

GitHub Actions ne peut pas recevoir directement un webhook Telegram. Interroger Telegram toutes les 5 minutes par un cron serait peu fiable, car les crons GitHub sont souvent retardés. Ce serait aussi coûteux en minutes si le dépôt est privé.

Le Worker gratuit reçoit donc le webhook Telegram et déclenche un `repository_dispatch` sur GitHub. Il peut aussi servir de formulaire de contact, en transmettant les demandes de devis directement sur le Telegram du charpentier.

---

## 2. Flux de travail « chantier »

1. Le charpentier envoie au bot ses photos et un message vocal ou texte, par exemple : « Réfection toiture ardoise à Vannes, 3 semaines ».
2. Le Worker vérifie le secret du webhook (en-tête `X-Telegram-Bot-Api-Secret-Token`) et la liste blanche de `chat_id`. Il déclenche ensuite le workflow `chantier.yml`.
3. Le workflow :
   - télécharge les photos (`getFile`) ;
   - **supprime les données EXIF**, dont le GPS, pour ne pas exposer l'adresse des clients ;
   - redimensionne les images avec `sharp` ;
   - transcrit le vocal avec Whisper via Groq ;
   - envoie photos et notes à un LLM multimodal, qui produit un fichier Markdown : titre, ville, prestations, matériaux, description et textes alternatifs des images.
4. Le résultat est commité sur une branche `chantier/vannes-ardoise-2026-10` et une pull request est ouverte.
5. Le bot envoie un aperçu au charpentier avec trois boutons :
   - ✅ **Publier** : fusionne la PR, ce qui lance le déploiement puis un ping IndexNow ;
   - ✏️ **Corriger** : attend sa réponse (texte ou vocal), régénère le texte et renvoie un nouvel aperçu ;
   - ❌ **Annuler** : ferme la PR.

L'état de chaque brouillon est porté par sa PR. Il n'y a donc aucune base de données à gérer.

---

## 3. Flux de travail « blog »

Un cron hebdomadaire choisit un sujet dans un fichier `topics.yml`, qui contient une liste de mots-clés classés par priorité. Le LLM rédige un article qui **s'appuie sur des chantiers réels du portfolio** (photos, villes, problèmes rencontrés). L'article suit ensuite le même circuit de validation par PR et Telegram.

Visez **2 à 4 articles par mois**, pas plus. Google sanctionne le contenu généré en masse (politique *scaled content abuse*). C'est le vécu réel du charpentier qui fait la différence. Le bot peut d'ailleurs lui poser une question avant la rédaction, par exemple : « Une anecdote sur ce type de chantier ? »

---

## 4. LLM gratuits, avec une chaîne de repli

| Usage | Fournisseur |
|---|---|
| Vision et rédaction | Google Gemini Flash (API gratuite) |
| Transcription des vocaux | Groq (Whisper) |
| Rédaction en secours | Groq (Llama) |
| Rédaction en secours | Mistral (offre gratuite « Experiment ») |
| Dernier recours | Modèles `:free` d'OpenRouter |

Les quotas des offres gratuites changent souvent. Prévoyez une fonction `generate()` qui passe automatiquement au fournisseur suivant en cas d'erreur 429.

Les offres gratuites peuvent utiliser vos données pour l'entraînement. Ce n'est pas gênant ici, car le contenu est destiné à être public.

---

## 5. Stratégie SEO locale : plan d'action sur 30 jours

### Semaine 1 : les fondations (impact le plus fort)

- Créer et compléter la **fiche Google Business Profile**. Pour un artisan local, c'est le premier levier, loin devant le site. Il faut des photos, la liste des services et la zone d'intervention.
- Mettre en place un processus systématique de **demande d'avis** après chaque chantier. Le bot peut envoyer un rappel avec le lien de dépôt d'avis.
- Inscrire le site dans **Google Search Console** et dans **Bing Webmaster Tools**. Bing alimente la recherche de ChatGPT et de Copilot.

### Semaine 2 : la structure du site

- Une page par service : charpente, couverture, zinguerie, gouttières, fenêtres de toit, isolation.
- Une page par ville, **uniquement là où il y a de vrais chantiers**. Sinon, Google les considère comme des pages satellites (*doorway pages*).
- Chaque chantier devient une mini-page d'atterrissage locale, avec des liens internes vers la page du service et celle de la ville.
- Données structurées Schema.org, générées automatiquement à partir du frontmatter des fichiers Markdown :
  - `RoofingContractor`, un type spécifique aux couvreurs ;
  - `Service`, `Article`, `BreadcrumbList` et `FAQPage`.

### Semaines 3 et 4 : la notoriété

- Assurer un **NAP** (Nom, Adresse, Téléphone) strictement identique partout : PagesJaunes, annuaires locaux, Houzz, Qualibat/RGE et CAPEB si le charpentier y est affilié.
- Ajouter un ping **IndexNow** dans le workflow, pour une indexation par Bing en quelques heures.

---

## 6. Stratégie GEO (visibilité dans les moteurs IA)

- **robots.txt :** autoriser explicitement les robots des moteurs IA, notamment `GPTBot`, `OAI-SearchBot`, `PerplexityBot`, `ClaudeBot` et `Google-Extended`.
- **Contenu facile à citer :** commencer chaque page par une réponse directe en 2 à 3 phrases, puis donner des faits précis (fourchettes de prix au m², durées, matériaux, normes DTU), puis une FAQ.
- **Entité cohérente :** même nom, même zone et mêmes spécialités sur le site, la fiche Google et les annuaires. Les LLM recoupent ces sources avant de recommander une entreprise.
- **Mentions externes :** les IA citent volontiers les sources tierces (annuaires, presse locale, forums). Une ou deux mentions dans la presse locale valent plus que dix articles de blog.
- **`llms.txt` :** à ajouter, car il ne coûte rien, même si son effet n'est pas encore prouvé.

---

## 7. Structure du dépôt

```
src/content/chantiers/*.md
src/content/blog/*.md
src/content/topics.yml
.github/workflows/chantier.yml
.github/workflows/blog.yml
.github/workflows/deploy.yml
scripts/          (llm.ts, telegram.ts, images.ts)
worker/           (webhook Telegram + formulaire de contact)
```

---

## 8. Transmettre la propriété au client

### Solution recommandée : partir dès le début sur une organisation

Créez une **organisation GitHub gratuite** au nom de l'entreprise du charpentier, par exemple `charpente-dupont`. Vous en êtes administrateur pendant le développement, et vous y ajoutez le charpentier comme propriétaire (*owner*).

À la livraison, il vous suffit de baisser votre rôle ou de quitter l'organisation : aucune URL ne change et rien ne casse. Si vous assurez ensuite la maintenance, vous restez simplement membre.

Appliquez la même logique à tous les services tiers, en créant les comptes **au nom du client dès le départ** :

| Élément | À créer au nom du client |
|---|---|
| Nom de domaine | Chez le registrar, avec ses coordonnées comme titulaire. C'est l'actif le plus important. |
| Cloudflare | Son compte, pour le Worker et éventuellement le DNS |
| Clés API des LLM | Son compte Google (Gemini), Groq, Mistral |
| Fiche Google Business Profile | Toujours à son nom, il en est le propriétaire légitime |
| Bot Telegram | Créé par lui via @BotFather, ou transféré ensuite (BotFather propose un transfert de propriété dans les réglages du bot, sous conditions comme l'activation de la double authentification) |

### Si le dépôt est déjà sur votre compte personnel

GitHub permet le transfert : *Settings → General → Danger Zone → Transfer ownership*. Vous indiquez le compte ou l'organisation de destination. S'il s'agit d'un compte personnel, le destinataire doit accepter le transfert. Le code, l'historique, les issues et les pull requests suivent, et les anciennes URL Git sont redirigées.

Points à vérifier :

- **GitHub Pages :** l'adresse `votrepseudo.github.io/site` n'est pas redirigée. Avec un domaine personnalisé, il faut reconfigurer le domaine dans les réglages Pages du nouveau propriétaire et refaire la vérification du domaine sur son compte.
- **Token GitHub (PAT) utilisé par le Worker :** il appartient à votre compte personnel. Après le transfert, générez-en un nouveau depuis le compte du client. Une GitHub App installée sur son organisation est encore plus propre.
- **Secrets GitHub Actions :** vérifiez-les après le transfert et ressaisissez-les si besoin (tokens Telegram, clés LLM). Profitez-en pour remplacer les clés créées sur vos propres comptes.
- **Webhooks et intégrations :** contrôlez-les un par un et testez le circuit complet (photo envoyée → PR créée → validation → déploiement).

### Aspect juridique

Le transfert technique ne transfère pas les droits d'auteur sur le code et les textes. En France, une cession de droits doit être **écrite** et préciser les droits cédés, leur étendue, la durée et le territoire.

Prévoyez une clause de cession dans votre devis ou votre contrat, ainsi qu'une mention sur la maintenance si vous continuez à intervenir. Pour un modèle de clause fiable, renseignez-vous auprès d'un juriste ou de votre organisation professionnelle.

### En résumé

Créez l'organisation GitHub et le nom de domaine au nom du charpentier dès aujourd'hui. Vous gardez la main techniquement, et la livraison se résume à un changement de rôle.
