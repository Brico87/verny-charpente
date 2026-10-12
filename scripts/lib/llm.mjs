// Génération de texte avec chaîne de repli : Gemini (vision) → Groq → Mistral → OpenRouter.
// Passe au fournisseur suivant en cas d'erreur (429, quota, panne). Les fournisseurs sans clé sont ignorés.

const openaiCompat = (name, url, keyEnv, model) => ({
  name, key: () => process.env[keyEnv], vision: false,
  async call({ system, prompt, json }, key) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env[`${keyEnv.replace('_API_KEY', '')}_MODEL`] || model,
        temperature: 0.6,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        ...(json && { response_format: { type: 'json_object' } }),
      }),
    });
    if (!res.ok) throw new Error(`${name} HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()).choices?.[0]?.message?.content ?? '';
  },
});

const gemini = {
  name: 'gemini', key: () => process.env.GEMINI_API_KEY, vision: true,
  async call({ system, prompt, images = [], json }, key) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map((b) => ({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } }))] }],
        generationConfig: { temperature: 0.6, ...(json && { responseMimeType: 'application/json' }) },
      }),
    });
    if (!res.ok) throw new Error(`gemini HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  },
};

const providers = [
  gemini,
  openaiCompat('groq', 'https://api.groq.com/openai/v1/chat/completions', 'GROQ_API_KEY', 'llama-3.3-70b-versatile'),
  openaiCompat('mistral', 'https://api.mistral.ai/v1/chat/completions', 'MISTRAL_API_KEY', 'mistral-small-latest'),
  openaiCompat('openrouter', 'https://openrouter.ai/api/v1/chat/completions', 'OPENROUTER_API_KEY', 'meta-llama/llama-3.3-70b-instruct:free'),
];

export function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(t);
}

/** Retourne le texte généré, ou un objet si json=true. Les images ne sont utilisées que par Gemini. */
export async function generate(opts) {
  const errors = [];
  for (const p of providers) {
    const key = p.key();
    if (!key) continue;
    try {
      const out = await p.call(opts, key);
      if (!out.trim()) throw new Error('réponse vide');
      return opts.json ? parseJson(out) : out;
    } catch (e) {
      console.warn(`[llm] ${p.name} a échoué : ${e.message}`);
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  throw new Error(`Aucun fournisseur LLM disponible. ${errors.join(' | ') || 'Aucune clé API configurée.'}`);
}

/** Transcription d'un vocal via Groq (Whisper). */
export async function transcribe(audio, filename = 'voice.ogg') {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY manquante : impossible de transcrire le vocal.');
  const form = new FormData();
  form.append('file', new Blob([audio]), filename);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'fr');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`Groq Whisper HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).text ?? '';
}
