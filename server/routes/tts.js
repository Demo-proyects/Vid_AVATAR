const express      = require('express');
const router       = express.Router();
const validation   = require('../middleware/validation');
const openaiService = require('../services/openaiService');

const TTS_VOICES = openaiService.voices; // ['alloy','echo','fable','onyx','nova','shimmer']

/**
 * GET /api/tts/voices
 * Lista las voces disponibles. Array vacío si OpenAI no está activo.
 */
router.get('/voices', (req, res) => {
  if (!openaiService.isAvailable()) {
    return res.json({ available: false, voices: [] });
  }
  const voices = TTS_VOICES.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
  res.json({ available: true, voices });
});

/**
 * POST /api/tts
 * Síntesis principal. Devuelve audio MP3 o 503 si no hay servicio activo.
 */
router.post('/', validation.validateTTSRequest, async (req, res) => {
  if (!openaiService.isAvailable()) {
    return res.status(503).json({
      error: 'Servicio de voz no disponible. Configura OPENAI_API_KEY para activar TTS.'
    });
  }

  const { text, voice } = req.body;
  const trimmedText     = text.trim();

  try {
    const audioBuffer = await openaiService.synthesize(trimmedText, voice);

    res.set({
      'Content-Type':   'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control':  'public, max-age=86400'
    });
    res.send(audioBuffer);

  } catch (error) {
    console.error('Error en TTS:', error);

    let statusCode   = 500;
    let errorMessage = 'Error al sintetizar voz';

    if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('429')) {
      statusCode   = 429;
      errorMessage = 'Límite de TTS excedido. Intenta más tarde.';
    } else if (error.message.includes('permission') || error.message.includes('auth') || error.message.includes('401')) {
      statusCode   = 403;
      errorMessage = 'Error de autenticación con el servicio de TTS.';
    }

    res.status(statusCode).json({
      error:   errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/tts/preview
 * Preview rápido (máx 100 caracteres).
 */
router.post('/preview', async (req, res) => {
  if (!openaiService.isAvailable()) {
    return res.status(503).json({ error: 'Servicio de voz no disponible.' });
  }

  const { text, voice } = req.body;
  if (!text || !voice) return res.status(400).json({ error: 'text y voice son requeridos' });
  if (text.length > 100) return res.status(400).json({ error: 'Preview demasiado largo (máx 100 caracteres)' });

  try {
    const audioBuffer = await openaiService.synthesize(text.trim(), voice);
    res.set({
      'Content-Type':   'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control':  'public, max-age=86400'
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error('Error en preview TTS:', error);
    res.status(500).json({ error: 'Error al generar preview de voz' });
  }
});

/**
 * GET /api/tts/stats — monitoreo del servicio
 */
router.get('/stats', (req, res) => {
  res.json({
    service:   'OpenAI TTS',
    available: openaiService.isAvailable(),
    model:     openaiService.models.tts,
    voices:    TTS_VOICES,
    status:    openaiService.isAvailable() ? 'operational' : 'inactive'
  });
});

module.exports = router;