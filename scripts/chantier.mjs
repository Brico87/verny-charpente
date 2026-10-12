// Événement repository_dispatch "chantier" : photos + notes (texte/vocal) envoyés sur Telegram
// → photos nettoyées (EXIF/GPS supprimés) + brouillon Markdown dans src/content/chantiers/.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { downloadFile } from './lib/telegram.mjs';
import { generate, transcribe } from './lib/llm.mjs';
import { slugify, uniqueSlug, writeMarkdown, setOutput, cleanList, clip, withClosing, STYLE_RULES, CLOSING_RULE } from './lib/content.mjs';

const MAX_PHOTOS = 8;
const p = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).client_payload ?? {};
const photoIds = (p.photos ?? []).slice(0, MAX_PHOTOS);
if (photoIds.length === 0) throw new Error('Aucune photo reçue.');

// 1. Notes : texte + transcription des vocaux
const notes = [...(p.texts ?? [])];
for (const id of p.voices ?? []) {
  const { buffer } = await downloadFile(id);
  notes.push(await transcribe(buffer));
}
const notesText = notes.map((n) => n.trim()).filter(Boolean).join('\n');

// 2. Photos : rotation selon EXIF puis suppression de toutes les métadonnées (GPS compris), redimensionnement
const today = new Date().toISOString().slice(0, 10);
const tmpName = `chantier-${today}`;
const full = [], small = [];
for (const id of photoIds) {
  const { buffer } = await downloadFile(id);
  const base = sharp(buffer).rotate(); // sharp n'écrit aucune métadonnée par défaut
  full.push(await base.clone().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer());
  small.push(await base.clone().resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer());
}

// 3. Rédaction
const system = `Tu rédiges la fiche d'un chantier pour le site d'un charpentier-couvreur-zingueur.\n${STYLE_RULES}`;
const prompt = `Notes de l'artisan :\n"""${notesText || '(aucune note)'}"""\n\nNombre de photos : ${full.length}.\n
Réponds en JSON strict avec les clés :
- title : titre précis (60 car. max)
- description : une phrase, 150 car. max
- city : ville ou secteur si cité dans les notes, sinon ""
- services : liste de prestations (ex. "Couverture ardoise", "Zinguerie")
- materials : liste de matériaux visibles ou cités, sinon []
- body : texte Markdown de 100 à 220 mots (sous-titres ## autorisés) décrivant le chantier : contexte, travaux, résultat (sans phrase de contact : elle va dans closing)
${CLOSING_RULE}
- alts : tableau de ${full.length} textes alternatifs (une phrase descriptive par photo, dans l'ordre)`;
const r = await generate({ system, prompt, images: small, json: true });

// 4. Fichiers
const title = clip(r.title, 90) || `Chantier du ${today}`;
const slug = uniqueSlug('src/content/chantiers', slugify(`${title}-${today.slice(0, 7)}`));
const imgDir = `public/images/chantiers/${slug}`;
mkdirSync(imgDir, { recursive: true });
const alts = Array.isArray(r.alts) ? r.alts : [];
const images = full.map((buf, i) => {
  writeFileSync(`${imgDir}/${i + 1}.jpg`, buf);
  return { src: `images/chantiers/${slug}/${i + 1}.jpg`, alt: clip(alts[i], 160) || title };
});
const data = {
  title,
  description: clip(r.description, 170) || title,
  date: today,
  ...(clip(r.city, 80) && { city: clip(r.city, 80) }),
  services: cleanList(r.services),
  materials: cleanList(r.materials),
  images,
};
const file = `src/content/chantiers/${slug}.md`;
writeMarkdown(file, data, withClosing(r.body, r.closing));
console.log(`[chantier] ${file} (${images.length} photos)`);
setOutput('slug', slug);
setOutput('file', file);
setOutput('branch', `chantier/${slug}`);
setOutput('title', title.replace(/\n/g, ' '));
