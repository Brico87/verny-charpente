// Préchargé avec `node --import ./scripts/lib/capture-error.mjs script.mjs` : en cas d'erreur non gérée,
// enregistre le message dans un fichier lu par scripts/notify-failure.mjs (alerte Telegram), puis quitte en échec.
import { writeFileSync } from 'node:fs';

export const errorFile = () => process.env.ERROR_FILE || `${process.env.RUNNER_TEMP || '/tmp'}/last-error.txt`;

const record = (e) => {
  try { writeFileSync(errorFile(), String(e?.message ?? e).slice(0, 1500)); } catch { /* ignoré */ }
  console.error(e);
  process.exit(1);
};
process.on('uncaughtException', record);
process.on('unhandledRejection', record);
