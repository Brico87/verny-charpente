// Étape finale (if: failure()) des workflows : explique sur Telegram ce qui a échoué.
// Env : CHAT_ID, STEPS (toJSON(steps)), WORKFLOW ; lit l'erreur capturée par capture-error.mjs.
import { existsSync, readFileSync } from 'node:fs';
import { say, esc } from './lib/telegram.mjs';
import { errorFile } from './lib/capture-error.mjs';

const { CHAT_ID, WORKFLOW = 'Workflow' } = process.env;
if (!CHAT_ID) { console.log('[alerte] CHAT_ID absent : aucune alerte envoyée.'); process.exit(0); }

const LABELS = {
  deps: 'installation des dépendances',
  gen: 'génération du brouillon (photos, LLM)',
  pr: 'création de la branche et de la pull request',
  br: 'récupération du brouillon à corriger',
  rev: 'application de la correction',
  push: 'enregistrement de la correction',
  notify: "envoi de l'aperçu sur Telegram",
};

let steps = {};
try { steps = JSON.parse(process.env.STEPS || '{}'); } catch { /* ignoré */ }
const failedId = Object.keys(steps).find((id) => steps[id]?.outcome === 'failure');
const step = LABELS[failedId] ?? (failedId ? `étape « ${failedId} »` : 'une étape de préparation');

const file = errorFile();
const cause = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';

const text = [
  `⚠️ <b>${esc(WORKFLOW)} : échec</b>`,
  `Étape : ${esc(step)}`,
  cause && `Erreur : <code>${esc(cause.slice(0, 700))}</code>`,
].filter(Boolean).join('\n');

await say(CHAT_ID, text);
console.log('[alerte] message envoyé');
