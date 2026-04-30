/**
 * openaiService.js — Cliente unificado de OpenAI
 * Cubre: Chat Completions (LLM) + TTS
 *
 * Variables de entorno:
 *   OPENAI_API_KEY      → requerida para activar el servicio
 *   OPENAI_LLM_MODEL    → modelo LLM  (default: gpt-4.1-mini)
 *   OPENAI_TTS_MODEL    → modelo TTS  (default: tts-1-hd)
 */

const { Readable } = require('stream');

const OPENAI_API_KEY   = process.env.OPENAI_API_KEY  || '';
const LLM_MODEL        = process.env.OPENAI_LLM_MODEL || 'gpt-4.1-mini';
const TTS_MODEL        = process.env.OPENAI_TTS_MODEL || 'tts-1-hd';
const OPENAI_BASE      = 'https://api.openai.com/v1';

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/**
 * Devuelve true si la API key tiene pinta de ser válida
 */
function isAvailable() {
  return typeof OPENAI_API_KEY === 'string'
    && OPENAI_API_KEY.startsWith('sk-')
    && OPENAI_API_KEY.length > 20;
}

/**
 * createChatStream — streaming compatible con el loop actual de groqService
 *
 * @param {Array}  messages    [{role, content}]
 * @param {Object} options     { temperature, maxTokens, systemPrompt }
 * @returns {AsyncIterable}    cada chunk: { choices: [{ delta: { content } }] }
 */
async function createChatStream(messages, options = {}) {
  const { temperature = 0.7, maxTokens = 1024, systemPrompt = '' } = options;

  const body = {
    model: LLM_MODEL,
    stream: true,
    max_tokens: maxTokens,
    temperature,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages
  };

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI LLM error ${response.status}: ${errText}`);
  }

  // Adapta el stream de fetch (ReadableStream) a un AsyncIterable
  // cuyo formato de chunk es idéntico al de groqService
  return _parseSseStream(response.body);
}

/**
 * synthesize — TTS via OpenAI
 *
 * @param {string} text   Texto a sintetizar
 * @param {string} voice  Una de OPENAI_VOICES (default: 'nova')
 * @returns {Buffer}      Audio MP3
 */
async function synthesize(text, voice = 'nova') {
  if (!isAvailable()) throw new Error('OpenAI TTS no disponible: falta OPENAI_API_KEY');

  const safeVoice = OPENAI_VOICES.includes(voice) ? voice : 'nova';

  const response = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice: safeVoice,
      response_format: 'mp3'
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI TTS error ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Convierte el ReadableStream de fetch (SSE) en un AsyncGenerator
 * cuyo formato coincide con el de Groq:
 *   chunk.choices[0].delta.content
 */
async function* _parseSseStream(readableStream) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // última línea incompleta

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          yield json; // { choices: [{ delta: { content } }] }
        } catch (_) {
          // línea malformada, ignorar
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

module.exports = {
  isAvailable,
  createChatStream,
  synthesize,
  voices: OPENAI_VOICES,
  models: { llm: LLM_MODEL, tts: TTS_MODEL }
};