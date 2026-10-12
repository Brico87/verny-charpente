import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';

export const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'article';

export function uniqueSlug(dir, base) {
  let slug = base, n = 2;
  while (existsSync(`${dir}/${slug}.md`)) slug = `${base}-${n++}`;
  return slug;
}

export function readMarkdown(file) {
  const m = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file} : frontmatter introuvable`);
  return { data: parse(m[1]), body: m[2].trim() };
}

export function writeMarkdown(file, data, body) {
  writeFileSync(file, `---\n${stringify(data, { lineWidth: 0 }).trim()}\n---\n${body.trim()}\n`);
}

export function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  else console.log(`[output] ${key}=${value}`);
}

export const cleanList = (v) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12) : []);
export const clip = (s, n) => String(s ?? '').trim().slice(0, n);

export const STYLE_RULES = `Règles impératives :
- Écris en français, à la première personne du pluriel ("nous"), ton simple et professionnel d'artisan.
- N'invente AUCUN fait : ni prix, ni durée, ni ville, ni garantie, ni certification, ni nom de client. Utilise uniquement les notes fournies et ce qui est visible sur les photos.
- Si une information (ville, matériaux) est inconnue, laisse le champ vide.
- Pas de superlatifs publicitaires ni de remplissage.`;

// Les pages /realisations/<slug>/ et /blog/<slug>/ sont à deux niveaux de la racine : ce lien relatif mène à
// l'ancre #contact de l'accueil quel que soit le préfixe (base) ou le domaine du site.
export const CONTACT_HREF = '../../#contact';
const CONTACT_RE = /contactez[- ]nous/i;
const stripLinks = (t) => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s*[\r\n]+\s*/g, ' ').trim();

/** Ajoute en dernier paragraphe la phrase d'appel au contact écrite par le LLM, avec « contactez-nous » en lien. */
export function withClosing(body, closing) {
  let c = stripLinks(clip(closing, 300)) || 'Une question, une demande de devis, contactez-nous';
  if (!CONTACT_RE.test(c)) c = `${c} Contactez-nous`;
  c = c.replace(CONTACT_RE, (m) => `[${m}](${CONTACT_HREF})`);
  return `${String(body ?? '').trim()}\n\n${c}`;
}

/** Sépare le corps et son dernier paragraphe de contact (celui qui contient le lien #contact). */
export function splitClosing(body) {
  const parts = body.trim().split(/\n{2,}/);
  const last = parts.at(-1) ?? '';
  if (parts.length > 1 && /\]\([^)]*#contact\)/.test(last)) return { main: parts.slice(0, -1).join('\n\n'), closing: stripLinks(last) };
  return { main: body.trim(), closing: '' };
}

export const CLOSING_RULE = `- closing : UNE phrase d'invitation à nous contacter, précise au contexte de ce texte (ex. pour une fenêtre de toit : « Vous avez un projet de fenêtre de toit ou une infiltration à traiter ? Contactez-nous pour un devis. »). Elle doit contenir le mot « contactez-nous », sans prix, délai ni promesse inventés.`;
