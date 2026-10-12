// Worker Cloudflare : reçoit le webhook Telegram, regroupe les photos d'un même envoi,
// puis déclenche GitHub (repository_dispatch). Gère aussi les boutons Publier / Corriger / Annuler.
//
// Secrets : TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, GITHUB_TOKEN (PAT), ALLOWED_USER_IDS
// Variable : GITHUB_REPO ("owner/repo")   KV : STATE

const BATCH_WAIT_MS = 20_000; // délai sans nouveau message avant de lancer le chantier

const HELP = `Bonjour ! Envoyez-moi :
📷 les photos d'un chantier (+ une légende ou un vocal pour décrire les travaux) → je prépare une fiche à valider ;
💡 /sujet <idée> → je prépare un article de blog sur ce sujet.

Chaque brouillon vous revient avec les boutons Publier / Corriger / Annuler.`;

const tg = (env, method, body) =>
  fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json());

const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'verny-telegram-worker', 'Content-Type': 'application/json',
    },
  });

const dispatch = (env, event_type, client_payload) =>
  gh(env, '/dispatches', { method: 'POST', body: JSON.stringify({ event_type, client_payload }) });

const say = (env, chat_id, text) => tg(env, 'sendMessage', { chat_id, text });

const allowed = (env, userId) => String(env.ALLOWED_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(String(userId));

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function onCallback(env, cb) {
  const chat = cb.message?.chat?.id;
  if (!allowed(env, cb.from?.id) || !chat) return;
  const m = /^(pub|fix|del):(\d{1,7})$/.exec(cb.data ?? '');
  if (!m) return;
  const [, action, pr] = m;
  const edit = (text) => tg(env, 'editMessageReplyMarkup', { chat_id: chat, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } })
    .then(() => say(env, chat, text));

  if (action === 'pub') {
    const res = await gh(env, `/pulls/${pr}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'squash' }) });
    if (res.ok) {
      await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Publié' });
      await edit('✅ Publié : le site se met à jour dans une ou deux minutes.');
    } else {
      await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Échec de la publication', show_alert: true });
      await say(env, chat, `⚠️ Publication impossible (${res.status}). Vérifiez la pull request ${pr} sur GitHub.`);
    }
  } else if (action === 'del') {
    const res = await gh(env, `/pulls/${pr}`);
    const ref = res.ok ? (await res.json()).head?.ref : null;
    await gh(env, `/pulls/${pr}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
    if (ref) await gh(env, `/git/refs/heads/${encodeURIComponent(ref).replace(/%2F/g, '/')}`, { method: 'DELETE' });
    await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Annulé' });
    await edit('❌ Brouillon annulé.');
  } else {
    await env.STATE.put(`fix:${chat}`, pr, { expirationTtl: 3600 });
    await tg(env, 'answerCallbackQuery', { callback_query_id: cb.id });
    await say(env, chat, '✏️ Que faut-il corriger ? Répondez par un message texte ou un vocal.');
  }
}

async function onMessage(env, msg) {
  const chat = msg.chat?.id;
  if (!chat) return;
  if (!allowed(env, msg.from?.id)) return; // silence pour les inconnus
  const text = (msg.text ?? msg.caption ?? '').trim();
  const photo = msg.photo?.at(-1)?.file_id;
  const voice = msg.voice?.file_id;

  if (/^\/(start|aide|help)\b/i.test(text)) return void (await say(env, chat, HELP));

  const topic = /^\/sujet(?:@\w+)?\s+([\s\S]+)/i.exec(text);
  if (topic) {
    await dispatch(env, 'blog_topic', { chat_id: chat, topic: topic[1].slice(0, 300) });
    return void (await say(env, chat, '💡 Sujet reçu, je prépare un article : aperçu dans quelques minutes.'));
  }

  // Correction en attente (bouton ✏️) : le prochain texte ou vocal sans photo est la consigne
  const pr = await env.STATE.get(`fix:${chat}`);
  if (pr && !photo && (text || voice)) {
    await env.STATE.delete(`fix:${chat}`);
    await dispatch(env, 'chantier_fix', { chat_id: chat, pr, text, voices: voice ? [voice] : [] });
    return void (await say(env, chat, '✏️ Correction en cours, nouvel aperçu dans quelques minutes.'));
  }

  if (!photo && !voice && !text) return;
  const key = `batch:${chat}`;
  const batch = JSON.parse((await env.STATE.get(key)) ?? '{"photos":[],"voices":[],"texts":[]}');
  if (photo) batch.photos.push(photo);
  if (voice) batch.voices.push(voice);
  if (text) batch.texts.push(text);
  batch.last = Date.now();
  await env.STATE.put(key, JSON.stringify(batch), { expirationTtl: 3600 });
  if (batch.photos.length + batch.voices.length + batch.texts.length === 1) await say(env, chat, '👍 Bien reçu, j’attends la suite (photos, note) avant de lancer.');
}

// Appelé chaque minute : lance les envois sans nouveau message depuis BATCH_WAIT_MS
async function flush(env) {
  const { keys } = await env.STATE.list({ prefix: 'batch:' });
  for (const { name } of keys) {
    const batch = JSON.parse((await env.STATE.get(name)) ?? 'null');
    if (!batch || Date.now() - batch.last < BATCH_WAIT_MS) continue;
    await env.STATE.delete(name);
    const chat = Number(name.slice('batch:'.length));
    if (batch.photos.length === 0) {
      await say(env, chat, '📷 Il me faut au moins une photo pour créer une fiche chantier. Renvoyez les photos avec une courte description.');
      continue;
    }
    const res = await dispatch(env, 'chantier', { chat_id: chat, photos: batch.photos, voices: batch.voices, texts: batch.texts });
    await say(env, chat, res.ok ? `⚙️ Je prépare la fiche (${batch.photos.length} photo(s)) : aperçu dans quelques minutes.` : `⚠️ Impossible de lancer la préparation (${res.status}).`);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/telegram') return new Response('Not found', { status: 404 });
    if (!safeEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '', env.TELEGRAM_WEBHOOK_SECRET ?? '\0')) return new Response('Forbidden', { status: 403 });
    const update = await request.json().catch(() => null);
    if (!update) return new Response('Bad request', { status: 400 });
    const work = update.callback_query ? onCallback(env, update.callback_query) : update.message ? onMessage(env, update.message) : null;
    if (work) ctx.waitUntil(work.catch((e) => console.error('handler', e)));
    return new Response('ok');
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(flush(env).catch((e) => console.error('flush', e)));
  },
};
