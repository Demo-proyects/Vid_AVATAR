const express = require('express');
const router = express.Router();
const validation = require('../middleware/validation');
const ttsService = require('../services/ttsService');

/**
 * Ruta principal de TTS
 */
router.post('/', validation.validateTTSRequest, async (req, res) => {
    const { text, voice } = req.body;
    const trimmedText = text.trim();

    try {
        const audioContent = await ttsService.synthesize(trimmedText, voice);
        
        // Configurar headers para audio
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioContent.length,
            'Cache-Control': 'public, max-age=86400', // 24 horas
            'X-TTS-Cache': 'hit'
        });
        
        res.send(audioContent);
        
    } catch (error) {
        console.error('Error en TTS:', error);
        
        // Determinar tipo de error
        let statusCode = 500;
        let errorMessage = 'Error al sintetizar voz';
        
        if (error.message.includes('quota') || error.message.includes('limit')) {
            statusCode = 429;
            errorMessage = 'Límite de TTS excedido. Intenta más tarde.';
        } else if (error.message.includes('permission') || error.message.includes('auth')) {
            statusCode = 403;
            errorMessage = 'Error de autenticación con el servicio de TTS.';
        }
        
        res.status(statusCode).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Ruta para monitoreo del servicio TTS
 */
router.get('/stats', (req, res) => {
    const stats = ttsService.getCacheStats();
    res.json({
        service: 'Google TTS',
        cache: stats,
        status: 'operational'
    });
});

/**
 * POST /api/tts/preview
 * Preview rápido de voz (validación simplificada)
 */
router.post('/preview', async (req, res) => {
    try {
        const { text, voice } = req.body;
        if (!text || !voice) {
            return res.status(400).json({ error: 'text y voice son requeridos' });
        }
        if (text.length > 100) {
            return res.status(400).json({ error: 'Preview demasiado largo (máx 100 caracteres)' });
        }
        const audioContent = await ttsService.synthesize(text.trim(), voice);
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioContent.length,
            'Cache-Control': 'public, max-age=86400'
        });
        res.send(audioContent);
    } catch (error) {
        console.error('Error en preview TTS:', error);
        res.status(500).json({ error: 'Error al generar preview de voz' });
    }
});

/**
 * Ruta para limpiar caché (solo en desarrollo)
 */
router.delete('/cache', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Solo disponible en desarrollo' });
    }
    
    ttsService.clearCache();
    res.json({ message: 'Caché de TTS limpiado' });
});

module.exports = router;
