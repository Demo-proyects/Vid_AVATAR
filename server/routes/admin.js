/**
 * Rutas del panel de administración
 *
 * Modelo de permisos aplicado:
 *   Público    → GET de config y stats (solo lectura)
 *   requireAuth → operaciones del usuario sobre su propia config
 *   requireAdmin → todo lo que afecta el sistema globalmente
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../services/database');
const memoryService = require('../services/memoryService');
const groqService = require('../services/groqService');
const config = require('../config');
const { requireAuth, requireAdmin } = require('../middleware/roles');

// ═══════════════════════════════════════════════
// SISTEMA
// ═══════════════════════════════════════════════

/**
 * GET /api/admin/system/status — público
 */
router.get('/system/status', async (req, res) => {
  try {
    const dbStats = await db.getDatabaseStats();
    res.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: config.server.nodeEnv,
      database: dbStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════
// CONFIGURACIÓN DEL AGENTE
// ═══════════════════════════════════════════════

/**
 * GET /api/admin/agent/config — público (lectura)
 */
router.get('/agent/config', async (req, res) => {
  try {
    const avatarId = req.query.avatarId || 'nara';
    const dbConfig = await db.getAvatarConfig(avatarId);
    res.json({ success: true, config: dbConfig || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/agent/config — solo admin supremo
 * Modifica la personalidad global (aplica a visitantes y usuarios sin override)
 */
router.put('/agent/config', requireAdmin, async (req, res) => {
  try {
    const { avatarId, nombre, personalidad, tono, rol, temperatura, maxTokens, prompt } = req.body;
    if (!avatarId) return res.status(400).json({ success: false, error: 'avatarId es requerido' });
    if (!config.validAvatars.includes(avatarId)) {
      return res.status(400).json({ success: false, error: `Avatar inválido. Válidos: ${config.validAvatars.join(', ')}` });
    }

    await db.saveAvatarConfig(avatarId, { nombre, personalidad, tono, rol, temperatura, maxTokens, prompt });
    res.json({ success: true, message: `Configuración global de ${avatarId} actualizada` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/agent/memory — público (lectura de resumen)
 */
router.get('/agent/memory', (req, res) => {
  try {
    const proyecto = memoryService.getProyectoActual();
    const { nombre, url, descripcion, objetivo } = proyecto;
    res.json({ success: true, memory: { proyecto: { nombre, url, descripcion, objetivo } } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/agent/memory — solo admin supremo
 */
router.put('/agent/memory', requireAdmin, async (req, res) => {
  try {
    const { memoriaPrincipal, memoriaProyectos } = req.body;
    const results = {};

    if (memoriaPrincipal) {
      results.principal = await memoryService.guardarMemoriaPrincipal(memoriaPrincipal);
    }
    if (memoriaProyectos) {
      if (!Array.isArray(memoriaProyectos.proyectos)) {
        return res.status(400).json({ success: false, error: 'memoriaProyectos debe contener array "proyectos"' });
      }
      results.proyectos = await memoryService.guardarMemoriaProyectos(memoriaProyectos);
    }

    res.json({ success: true, message: 'Memoria actualizada', results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/agent/test — solo admin supremo
 * Prueba el agente (consume cuota de Groq — proteger con auth)
 */
router.post('/agent/test', requireAdmin, async (req, res) => {
  try {
    const { message, avatarId } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message es requerido' });

    const testAvatar = avatarId || 'nara';
    const messages = [{ role: 'user', content: message }];
    const systemPrompt = groqService.getSystemPrompt(testAvatar);

    const stream = await groqService.createChatStream(messages, testAvatar, { systemPrompt, maxTokens: 256 });

    let response = '';
    for await (const chunk of stream) {
      response += chunk.choices[0]?.delta?.content || '';
    }

    res.json({ success: true, response, avatarId: testAvatar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════
// CONFIGURACIÓN DE AVATARES
// ═══════════════════════════════════════════════

/**
 * GET /api/admin/avatar/configs — público (lectura)
 */
router.get('/avatar/configs', async (req, res) => {
  try {
    const configs = {};
    for (const avatarId of config.validAvatars) {
      configs[avatarId] = await db.getAvatarConfig(avatarId) || {};
    }
    res.json({ success: true, configs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/avatar/configs — solo admin supremo
 * Actualiza config global de uno o varios avatares
 */
router.put('/avatar/configs', requireAdmin, async (req, res) => {
  try {
    const { avatarId, config: avatarConfig } = req.body;
    if (!avatarId || !avatarConfig) {
      return res.status(400).json({ success: false, error: 'avatarId y config son requeridos' });
    }
    if (!config.validAvatars.includes(avatarId)) {
      return res.status(400).json({ success: false, error: 'Avatar inválido' });
    }

    await db.saveAvatarConfig(avatarId, avatarConfig);
    res.json({ success: true, message: `Config global de ${avatarId} actualizada` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/avatar/user-configs — usuario logueado
 * Devuelve las configs personales del usuario autenticado
 */
router.get('/avatar/user-configs', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userConfigs = {};
    for (const avatarId of config.validAvatars) {
      userConfigs[avatarId] = await db.getUserAvatarConfig(userId, avatarId) || {};
    }
    res.json({ success: true, configs: userConfigs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/avatar/user-config — usuario logueado
 * El usuario modifica la personalidad del avatar SOLO para sí mismo
 */
router.put('/avatar/user-config', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatarId, nombre, personalidad, tono, rol, contexto, tel, email, horario, link, cta, flows } = req.body;

    if (!avatarId) return res.status(400).json({ success: false, error: 'avatarId es requerido' });
    if (!config.validAvatars.includes(avatarId)) {
      return res.status(400).json({ success: false, error: 'Avatar inválido' });
    }

    await db.saveUserAvatarConfig(userId, avatarId, { nombre, personalidad, tono, rol, contexto, tel, email, horario, link, cta, flows });
    res.json({ success: true, message: `Tu config personal de ${avatarId} fue actualizada` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/daily-usage — usuario logueado
 * Devuelve el uso diario del usuario (para límite de 10 guardados/día)
 */
router.get('/daily-usage', requireAuth, async (req, res) => {
  try {
    const count = await db.getDailyUsage(req.user.id);
    res.json({ success: true, count, limit: 10 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════
// ARCHIVOS DE CONTEXTO
// ═══════════════════════════════════════════════

const UPLOAD_DIR = path.join(__dirname, '../../uploads/context');
const ALLOWED_TYPES = ['text/plain', 'application/json', 'text/markdown'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * GET /api/admin/files — público (listar archivos disponibles)
 */
router.get('/files', async (req, res) => {
  try {
    const files = await db.getContextFiles();
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/files/upload — solo admin supremo
 */
router.post('/files/upload', requireAdmin, async (req, res) => {
  try {
    if (!req.files?.file) return res.status(400).json({ success: false, error: 'No se envió ningún archivo' });

    const file = req.files.file;

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ success: false, error: `Tipo de archivo no permitido. Permitidos: ${ALLOWED_TYPES.join(', ')}` });
    }
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, error: 'Archivo demasiado grande (máx 5MB)' });
    }

    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const safeFilename = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(UPLOAD_DIR, safeFilename);
    await file.mv(filePath);

    const fileRecord = await db.saveContextFile({
      filename: safeFilename,
      originalName: file.name,
      size: file.size,
      mimeType: file.mimetype,
      path: filePath
    });

    res.json({ success: true, file: fileRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/files/:id — solo admin supremo
 */
router.delete('/files/:id', requireAdmin, async (req, res) => {
  try {
    const result = await db.deleteContextFile(req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════
// ESTADÍSTICAS Y EVENTOS
// ═══════════════════════════════════════════════

/**
 * GET /api/admin/stats — público (métricas generales)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getDatabaseStats();
    res.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/events — solo admin supremo
 */
router.get('/events', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const events = await db.getEvents(limit);
    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════
// CONVERSACIONES DESDE ADMIN
// ═══════════════════════════════════════════════

/**
 * GET /api/admin/conversations — solo admin supremo (con contenido completo)
 * Solo muestra conversaciones de los últimos 10 minutos
 */
router.get('/conversations', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 100);
    // Auto-cleanup al listar: borra las que tienen más de 10 min
    await db.cleanupOldConversationsMinutes(10);
    const result = await db.listRecentConversations(10, page, pageSize);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/conversations/clear — solo admin supremo
 * FIX: usa db.clearAllConversations() en lugar de acceder a db.db directamente
 */
router.delete('/conversations/clear', requireAdmin, async (req, res) => {
  try {
    const result = await db.clearAllConversations();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
