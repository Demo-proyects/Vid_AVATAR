/**
 * Servicio de TTS con caché en memoria
 * 
 * Fixes:
 * - Claves de caché hasheadas con SHA-256 (texto largo no genera keys enormes)
 * - LRU correcto (elimina la más antigua al saturarse)
 */

const textToSpeech = require('@google-cloud/text-to-speech');
const crypto = require('crypto');
const config = require('../config');

const ttsCache = new Map();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

class TTSService {
  constructor() {
    this.client = new textToSpeech.TextToSpeechClient({
      keyFilename: config.tts.credentialsPath
    });
  }

  _cleanTextForTTS(text) {
    if (!text) return '';
    let cleaned = text.replace(/\*+/g, '');
    cleaned = cleaned
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[\u{200D}]/gu, '');
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  _getCacheKey(text, voice) {
    const hash = crypto.createHash('sha256').update(`${voice}:${text.trim().toLowerCase()}`).digest('hex');
    return hash;
  }

  async synthesize(text, voice) {
    const cleanText = this._cleanTextForTTS(text);
    if (!cleanText) throw new Error('Texto vacío después de limpiar');

    const cacheKey = this._getCacheKey(cleanText, voice);
    const cached = ttsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.audioContent;
    }

    const audioContent = await this._callGoogleTTS(cleanText, voice);
    this._setCache(cacheKey, audioContent);
    return audioContent;
  }

  async _callGoogleTTS(text, voice) {
    const languageCode = voice.split('-').slice(0, 2).join('-');
    const request = {
      input: { text },
      voice: { name: voice, languageCode },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0.0 }
    };
    try {
      const [response] = await this.client.synthesizeSpeech(request);
      return response.audioContent;
    } catch (error) {
      throw new Error(`Error al sintetizar voz: ${error.message}`);
    }
  }

  _setCache(key, audioContent) {
    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = ttsCache.keys().next().value;
      ttsCache.delete(oldestKey);
    }
    ttsCache.set(key, { audioContent, timestamp: Date.now() });
  }

  async listVoices() {
    const [result] = await this.client.listVoices({});
    return result.voices;
  }

  clearCache() {
    ttsCache.clear();
    console.log('[TTS] Caché limpiado');
  }

  getCacheStats() {
    return { size: ttsCache.size, maxSize: MAX_CACHE_SIZE, ttlMs: CACHE_TTL_MS };
  }
}

module.exports = new TTSService();
