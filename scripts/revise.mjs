// Événement "chantier_fix" : applique une correction (texte ou vocal) à un brouillon existant.
// Env : FILE = fichier Markdown à corriger (déjà sur la branche du brouillon).
import { readFileSync } from 'node:fs';
import { downloadFile } from './lib/telegram.mjs';
import { generate, transcribe } from './lib/llm.mjs';
import { readMarkdown, writeMarkdown, cleanList, clip, setOutput, STYLE_RULES } from './lib/content.mjs';

const file = process.env.FILE;
if (!file || !/^src\/content\/(chantiers|blog)\/[\w-]+\.md$/.test(file)) throw new Error(`FILE invalide : ${file}`);
const p = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).client_payload ?? {};

const parts = [p.text ?? ''];
for (const id of p.voices ?? []) parts.push(await transcribe((await downloadFile(id)).buffer));
const instruction = parts.map((s) => s.trim()).filter(Boolean).join('\n');
if (!instruction) throw new Error('Aucune consigne de correction.');

const { data, body } = readMarkdown(file);
const system = `Tu corriges la fiche d'un site de charpentier-couvreur-zingueur selon la demande de l'artisan.\n${STYLE_RULES}`;
const prompt = `Fiche actuelle :
titre : ${data.title}
description : ${data.description}
${data.city ? `ville : ${data.city}\n` : ''}services : ${(data.services ?? []).join(', ')}
matériaux : ${(data.materials ?? []).join(', ')}
texte :
"""${body}"""

Demande de correction de l'artisan :
"""${instruction}"""

Réponds en JSON strict avec les clés title, description (170 car. max), city, services, materials, body (Markdown). Reprends à l'identique ce qui n'est pas concerné par la demande.`;
const r = await generate({ system, prompt, json: true });

const next = { ...data };
if (clip(r.title, 90)) next.title = clip(r.title, 90);
if (clip(r.description, 170)) next.description = clip(r.description, 170);
if ('city' in data || clip(r.city, 80)) { const c = clip(r.city, 80); if (c) next.city = c; else delete next.city; }
if ('services' in data) next.services = cleanList(r.services);
if ('materials' in data) next.materials = cleanList(r.materials);
writeMarkdown(file, next, String(r.body || body));
setOutput('title', next.title.replace(/\n/g, ' '));
console.log(`[revise] ${file} mis à jour`);
