/**
 * Middleware de validación para rutas de chat y TTS
 */

const validation = {
  /**
   * Valida el cuerpo de la petición de chat
   */
  validateChatRequest(req, res, next) {
    const { messages, avatar } = req.body;

    // Validar que messages exista y sea un array
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Mensajes inválidos',
        details: 'El campo "messages" debe ser un array'
      });
    }

    // Validar que cada mensaje tenga la estructura correcta
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.role || !msg.content) {
        return res.status(400).json({
          error: `Mensaje ${i} inválido`,
          details: 'Cada mensaje debe tener "role" y "content"'
        });
      }
      
      if (!['user', 'assistant', 'system'].includes(msg.role)) {
        return res.status(400).json({
          error: `Rol inválido en mensaje ${i}`,
          details: 'El rol debe ser "user", "assistant" o "system"'
        });
      }
    }

    // Validar avatar
    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({
        error: 'Avatar inválido',
        details: 'El campo "avatar" es requerido y debe ser un string'
      });
    }

    // Avatares válidos
    const validAvatars = ['nara', 'mimi', 'ava03', 'vid'];
    if (!validAvatars.includes(avatar)) {
      return res.status(400).json({
        error: 'Avatar no soportado',
        details: `Avatar debe ser uno de: ${validAvatars.join(', ')}`
      });
    }

    next();
  },

  /**
   * Valida el cuerpo de la petición de TTS
   */
  validateTTSRequest(req, res, next) {
    const { text, voice } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Texto inválido',
        details: 'El campo "text" es requerido y debe ser un string'
      });
    }

    // Validar longitud del texto
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return res.status(400).json({
        error: 'Texto vacío',
        details: 'El texto no puede estar vacío'
      });
    }

    if (trimmedText.length > 500) {
      return res.status(400).json({
        error: 'Texto demasiado largo',
        details: 'El texto no puede exceder 500 caracteres'
      });
    }

    // Validar caracteres peligrosos (opcional)
    const dangerousPattern = /[<>{}[\]]/;
    if (dangerousPattern.test(trimmedText)) {
      return res.status(400).json({
        error: 'Caracteres no permitidos',
        details: 'El texto contiene caracteres potencialmente peligrosos'
      });
    }

    if (!voice || typeof voice !== 'string') {
      return res.status(400).json({
        error: 'Voz inválida',
        details: 'El campo "voice" es requerido y debe ser un string'
      });
    }

    // Validar formato de voz (ej: es-US-Neural2-B)
    const voicePattern = /^[a-z]{2}-[A-Z]{2}-[a-zA-Z0-9-]+$/;
    if (!voicePattern.test(voice)) {
      return res.status(400).json({
        error: 'Formato de voz inválido',
        details: 'La voz debe tener un formato válido (ej: es-US-Neural2-B)'
      });
    }

    next();
  }
};

module.exports = validation;
