/**
 * Servicio para interacción con Groq API con memoria integrada
 */

const Groq = require('groq-sdk');
const config = require('../config');
const memoryService = require('./memoryService');

class GroqService {
  constructor() {
    this.client = new Groq({
      apiKey: config.groq.apiKey
    });
    this.model = config.groq.models.fast;
  }

  /**
   * Crea un stream de chat con memoria integrada
   */
  async createChatStream(messages, avatar, options = {}) {
    try {
      const systemPrompt = options.systemPrompt || this.getSystemPrompt(avatar);
      
      // Verificar si el último mensaje del usuario menciona otros proyectos
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find(m => m.role === 'user');
      
      let finalMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];
      
      // Si hay consulta sobre otros proyectos, añadir información relevante
      if (lastUserMessage && this._contieneConsultaProyectos(lastUserMessage.content)) {
        const proyectosRelevantes = memoryService.buscarProyecto(lastUserMessage.content);
        if (proyectosRelevantes.length > 0) {
          const infoProyectos = this._formatearInfoProyectos(proyectosRelevantes);
          finalMessages.splice(1, 0, {
            role: 'system',
            content: `INFORMACIÓN DE PROYECTOS RELACIONADOS:\n${infoProyectos}\n\nUsa esta información para responder a la pregunta sobre otros proyectos.`
          });
        }
      }
      
      const completion = await this.client.chat.completions.create({
        messages: finalMessages,
        model: this.model,
        stream: true,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1024
      });

      return completion;
    } catch (error) {
      console.error('Error en GroqService:', error);
      throw new Error(`Error al conectar con Groq API: ${error.message}`);
    }
  }

  /**
   * Obtiene el prompt del sistema para un avatar (con memoria principal)
   */
  getSystemPrompt(avatar, overrides = {}) {
    return memoryService.generateSystemPrompt(avatar, overrides);
  }

  /**
   * Genera una respuesta de fallback para un avatar
   */
  getFallbackResponse(avatar) {
    return avatar === 'mimi' 
      ? '😊 ¿Puedes contarme más?' 
      : 'Cuéntame más.';
  }

  /**
   * Detecta si un mensaje contiene consultas sobre otros proyectos
   */
  _contieneConsultaProyectos(texto) {
    const palabrasClave = [
      'proyecto', 'proyectos', 'trabajo', 'portfolio', 
      'guervency', 'luneca', 'desarrollo', 'creación',
      'qué más', 'otros', 'has hecho', 'has trabajado'
    ];
    
    const textoLower = texto.toLowerCase();
    return palabrasClave.some(palabra => textoLower.includes(palabra));
  }

  /**
   * Formatea información de proyectos para incluir en el prompt
   */
  _formatearInfoProyectos(proyectos) {
    return proyectos.map((p, i) => {
      return `[${i + 1}] ${p.nombre}${p.url ? ` (${p.url})` : ''}
      - ${p.descripcion || 'Sin descripción'}
      - Tecnologías: ${p.tecnologias?.join(', ') || 'No especificadas'}
      - Estado: ${p.estado || 'Desconocido'}
      ${p.notas ? `- Notas: ${p.notas}` : ''}`;
    }).join('\n\n');
  }

  /**
   * Busca proyectos en memoria secundaria (para endpoints API)
   */
  buscarProyectos(query) {
    return memoryService.buscarProyecto(query);
  }
}

module.exports = new GroqService();
