// Envoie l'aperçu du brouillon sur Telegram avec les boutons Publier / Corriger / Annuler.
// Env : CHAT_ID, PR_NUMBER, PR_URL, FILE
import { readMarkdown } from './lib/content.mjs';
import { sendPreview } from './lib/telegram.mjs';

const { CHAT_ID, PR_NUMBER, PR_URL, FILE } = process.env;
if (!CHAT_ID || !PR_NUMBER || !PR_URL || !FILE) throw new Error('CHAT_ID, PR_NUMBER, PR_URL et FILE sont requis.');
const { data } = readMarkdown(FILE);
const extra = [data.city && `📍 ${data.city}`, data.services?.length && `🔧 ${data.services.join(', ')}`, data.images?.length && `📷 ${data.images.length} photo(s)`].filter(Boolean).join('\n');
await sendPreview(CHAT_ID, { prNumber: PR_NUMBER, prUrl: PR_URL, title: data.title, description: data.description, extra });
