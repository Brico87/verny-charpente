// Article de blog sur demande : sujet reçu via /sujet (Telegram) ou lancement manuel,
// rédigé en s'appuyant sur les chantiers réels du portfolio.
import { readFileSync, readdirSync } from 'node:fs';
import { generate } from './lib/llm.mjs';
import { slugify, uniqueSlug, readMarkdown, writeMarkdown, setOutput, clip, STYLE_RULES } from './lib/content.mjs';

const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
const topic = clip(event.client_payload?.topic, 300) || clip(process.env.TOPIC, 300);
if (!topic) throw new Error('Aucun sujet fourni (utiliser /sujet <idée> sur Telegram).');

// Contexte : les chantiers les plus récents (publiés ou en brouillon sur la branche)
const dir = 'src/content/chantiers';
const context = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readMarkdown(`${dir}/${f}`))
  .filter((c) => !c.data.draft).sort((a, b) => String(b.data.date).localeCompare(String(a.data.date))).slice(0, 4)
  .map((c) => `- ${c.data.title}${c.data.city ? ` (${c.data.city})` : ''} : ${c.data.description}`).join('\n');

const system = `Tu rédiges un article de conseils pour le blog d'un charpentier-couvreur-zingueur (Landes et Pays Basque).\n${STYLE_RULES}
- Commence par une réponse directe en 2 à 3 phrases, puis développe avec des sous-titres ## et des listes, puis termine par une courte FAQ (2 à 3 questions).
- Tu peux t'appuyer sur les chantiers réels listés pour illustrer, sans rien inventer à leur sujet.
- 400 à 700 mots.`;
const prompt = `Sujet : ${topic}

Chantiers récents de l'entreprise :
${context || '(aucun)'}

Réponds en JSON strict avec les clés : title (70 car. max), description (160 car. max), body (Markdown, sans le titre H1).`;
const r = await generate({ system, prompt, json: true });

const today = new Date().toISOString().slice(0, 10);
const title = clip(r.title, 90) || topic;
const slug = uniqueSlug('src/content/blog', slugify(title));
const file = `src/content/blog/${slug}.md`;
writeMarkdown(file, { title, description: clip(r.description, 170) || title, date: today, category: 'Conseil' }, String(r.body ?? ''));

console.log(`[blog] ${file}`);
setOutput('slug', slug);
setOutput('file', file);
setOutput('branch', `blog/${slug}`);
setOutput('title', title.replace(/\n/g, ' '));
