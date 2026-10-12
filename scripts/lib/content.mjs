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
