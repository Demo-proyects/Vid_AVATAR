/**
 * Orquestador de servicios de IA
 * Groq siempre como principal. DeepSeek solo en emergencia (5xx/timeout).
 *
 * Jerarquía de personalidad:
 *   1. user_avatar_config (usuario logueado con override personal)
 *   2. avatar_config global (config del admin)
 *   3. memoryService defaults (memoria principal JSON)
 */

const groqService = require('./groqService');
const deepseekService = require('./deepseekService');
const database = require('./database');
const config = require('../config');

const _promptCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

class AIRouter {
  /**
   * @param {Array}  messages           Mensajes en formato {role, content}
   * @param {Object} options
   * @param {string} options.avatar
   * @param {string} [options.context]
   * @param {string} [options.sessionId]
   * @param {number} [options.userId]   ID del usuario logueado (null = visitante)
   */
  async routeAI(messages, options = {}) {
    const {
      avatar = 'nara',
      temperature = 0.7,
      maxTokens = 1024,
      context = '',
      sessionId = null,
      userId = null
    } = options;

    const systemPrompt = await this._buildSystemPrompt(avatar, context, userId);

    console.log(`[AI Router] Groq (sesión: ${sessionId || 'nueva'}, usuario: ${userId || 'visitante'})`);

    try {
      const stream = await groqService.createChatStream(messages, avatar, {
        temperature,
        maxTokens,
        systemPrompt
      });
      return { stream, provider: 'groq' };
    } catch (error) {
      const isServerError = !error.statusCode || error.statusCode >= 500
        || error.message.includes('timeout')
        || error.message.includes('ECONNREFUSED')
        || error.message.includes('ETIMEDOUT');

      if (isServerError) {
        console.warn('[AI Router] Groq caído, usando DeepSeek fallback...', error.message);
        try {
          const stream = await this._tryDeepSeek(messages, { temperature, maxTokens }, systemPrompt);
          return { stream, provider: 'deepseek' };
        } catch (deepseekError) {
          console.error('[AI Router] Todos los proveedores fallaron:', deepseekError.message);
          throw new Error('Todos los proveedores de IA fallaron');
        }
      }

      throw error;
    }
  }

  async _tryDeepSeek(messages, options, systemPrompt) {
    const finalMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    return deepseekService.createChatStream(finalMessages, options);
  }

  /**
   * Construye el system prompt aplicando la jerarquía correcta:
   * user_avatar_config > avatar_config global > memoryService defaults
   */
  async _buildSystemPrompt(avatar, projectContext = '', userId = null) {
    if (userId) {
      try {
        const userConfig = await database.getUserAvatarConfig(userId, avatar);
        if (userConfig && Object.keys(userConfig).length > 0) {
          const globalConfig = await database.getAvatarConfig(avatar) || {};
          const merged = { ...globalConfig, ...userConfig };
          return this._buildPromptFromConfig(avatar, merged, projectContext);
        }
      } catch (_) {}
    }

    const cacheKey = `${avatar}:${projectContext.substring(0, 50)}`;
    const cached = _promptCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      return cached.prompt;
    }

    let dbConfig = null;
    try {
      dbConfig = await database.getAvatarConfig(avatar);
    } catch (_) {}

    let prompt;
    if (dbConfig?.prompt) {
      prompt = projectContext?.trim()
        ? `${dbConfig.prompt}\n\nCONTEXTO ESPECÍFICO DEL PROYECTO:\n${projectContext}`
        : dbConfig.prompt;
    } else {
      const overrides = {};
      if (dbConfig?.nombre)       overrides.nombre       = dbConfig.nombre;
      if (dbConfig?.personalidad) overrides.personalidad = dbConfig.personalidad;
      if (dbConfig?.tono)         overrides.tono         = dbConfig.tono;
      if (dbConfig?.rol)          overrides.rol          = dbConfig.rol;

      const basePrompt = groqService.getSystemPrompt(avatar, overrides);
      prompt = projectContext?.trim()
        ? `${basePrompt}\n\nCONTEXTO ESPECÍFICO DEL PROYECTO:\n${projectContext}`
        : basePrompt;
    }

    _promptCache.set(cacheKey, { prompt, ts: Date.now() });
    return prompt;
  }

  _buildPromptFromConfig(avatar, mergedConfig, projectContext = '') {
    if (mergedConfig.prompt) {
      return projectContext?.trim()
        ? `${mergedConfig.prompt}\n\nCONTEXTO ESPECÍFICO DEL PROYECTO:\n${projectContext}`
        : mergedConfig.prompt;
    }

    const overrides = {};
    if (mergedConfig.nombre)       overrides.nombre       = mergedConfig.nombre;
    if (mergedConfig.personalidad) overrides.personalidad = mergedConfig.personalidad;
    if (mergedConfig.tono)         overrides.tono         = mergedConfig.tono;
    if (mergedConfig.rol)          overrides.rol          = mergedConfig.rol;

    const basePrompt = groqService.getSystemPrompt(avatar, overrides);
    return projectContext?.trim()
      ? `${basePrompt}\n\nCONTEXTO ESPECÍFICO DEL PROYECTO:\n${projectContext}`
      : basePrompt;
  }
}

module.exports = new AIRouter();
