const token = () => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN manquant.');
  return t;
};

export async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method} : ${data.description}`);
  return data.result;
}

/** Télécharge un fichier Telegram (photo, vocal) à partir de son file_id. */
export async function downloadFile(fileId) {
  if (!/^[\w-]{10,200}$/.test(fileId)) throw new Error('file_id invalide');
  const f = await tg('getFile', { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${f.file_path}`);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  return { buffer: Buffer.from(await res.arrayBuffer()), path: f.file_path };
}

export const say = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Aperçu d'un brouillon avec les boutons Publier / Corriger / Annuler. */
export function sendPreview(chat_id, { prNumber, prUrl, title, description, extra = '' }) {
  return say(chat_id, `<b>${esc(title)}</b>\n${esc(description)}${extra ? `\n\n${esc(extra)}` : ''}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Publier', callback_data: `pub:${prNumber}` }, { text: '✏️ Corriger', callback_data: `fix:${prNumber}` }, { text: '❌ Annuler', callback_data: `del:${prNumber}` }],
        [{ text: '👀 Voir le brouillon', url: prUrl }],
      ],
    },
  });
}
