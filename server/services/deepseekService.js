/**
 * Servicio para interactuar con DeepSeek API (compatible con OpenAI SDK)
 */

const OpenAI = require('openai');
const config = require('../config');

class DeepSeekService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1'
    });
    this.model = 'deepseek-chat';
  }

  /**
   * Crea un stream de chat con DeepSeek API.
   * @param {Array} messages - Array de mensajes en formato OpenAI
   * @param {Object} options - { temperature, maxTokens }
   * @returns {Promise<ReadableStream>} Stream de respuesta
   */
  async createChatStream(messages, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 1024
    } = options;

    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model: this.model,
        stream: true,
        temperature,
        max_tokens: maxTokens
      });

      return completion;
    } catch (error) {
      console.error('Error en DeepSeekService:', error);
      throw new Error(`Error al conectar con DeepSeek API: ${error.message}`);
    }
  }

  /**
   * Genera una respuesta de fallback (para compatibilidad con groqService)
   */
  getFallbackResponse(avatar) {
    return avatar === 'mimi' 
      ? '😊 ¿Puedes contarme más?' 
      : 'Cuéntame más.';
  }
}

module.exports = new DeepSeekService();
