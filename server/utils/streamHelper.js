/**
 * Helper para manejo de Server-Sent Events (SSE)
 */

class StreamHelper {
  /**
   * Configura headers SSE
   */
  static setupSSEHeaders(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffering en Nginx
  }

  /**
   * Envía un chunk de datos SSE
   */
  static sendChunk(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Envía el evento de finalización
   */
  static sendDone(res) {
    res.write('data: [DONE]\n\n');
  }

  /**
   * Maneja errores en streams SSE
   */
  static handleStreamError(error, res) {
    console.error('Error en stream:', error);
    
    // Si los headers ya se enviaron, enviar error como SSE
    if (res.headersSent) {
      const fallback = 'Lo siento, hubo un error. Intenta de nuevo.';
      this.sendChunk(res, { content: fallback });
      this.sendDone(res);
      res.end();
      return;
    }
    
    // Si los headers no se enviaron, responder con JSON
    res.status(500).json({ error: 'Error al generar respuesta de IA' });
  }

  /**
   * Procesa un stream de Groq y envía chunks SSE
   */
  static async processGroqStream(stream, res) {
    let hasContent = false;

    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          hasContent = true;
          this.sendChunk(res, { content });
        }
      }
      return hasContent;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = StreamHelper;
