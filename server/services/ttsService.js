/**
 * ttsService.js — OBSOLETO
 *
 * Google Cloud TTS fue eliminado como parte de la migración a OpenAI TTS.
 * Este archivo se conserva para no romper imports existentes, pero
 * ninguna ruta activa debería llamar a sus métodos.
 *
 * Si ves este error en los logs, busca el código que aún importa
 * ttsService y cámbialo por openaiService (server/services/openaiService.js).
 */

// ── CAMBIO: eliminada toda la implementación de Google Cloud TTS ──

module.exports = {
  /**
   * @throws {Error} siempre — Google TTS eliminado
   */
  synthesize: async (_text, _voice) => {
    throw new Error(
      '[ttsService] Google TTS eliminado. Usa openaiService.synthesize() en su lugar.'
    );
  },

  /** No-op: no hay caché que limpiar */
  clearCache: () => {
    console.warn('[ttsService] clearCache() llamado en servicio obsoleto. No hace nada.');
  },

  /** Devuelve stats vacíos para no romper código de monitoreo */
  getCacheStats: () => ({
    size: 0,
    maxSize: 0,
    ttlMs: 0,
    message: 'Google TTS desactivado — usa openaiService'
  }),

  /** Lanza error si alguien llama a listVoices() */
  listVoices: async () => {
    throw new Error(
      '[ttsService] listVoices() no disponible. Google TTS eliminado.'
    );
  }
};