/**
 * Rutas de conversaciones
 * 
 * Lectura pública → metadatos únicamente (sin contenido de mensajes)
 * Lectura detallada → solo admin
 * Escritura/eliminación → requireAuth o requireAdmin
 */

const express = require('express');
const router = express.Router();
const db = require('../services/database');
const { requireAuth, requireAdmin } = require('../middleware/roles');

/**
 * Guardar conversación (público — el chat lo llama automáticamente)
 */
router.post('/save', async (req, res) => {
  try {
    const { sessionId, avatarId, messages } = req.body;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'sessionId inválido' });
    if (!avatarId || typeof avatarId !== 'string') return res.status(400).json({ error: 'avatarId inválido' });
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages inválido' });

    const result = await db.saveConversation(sessionId, avatarId, messages);
    res.json({ success: true, ...result, sessionId, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error al guardar conversación:', error);
    res.status(500).json({ error: 'Error interno al guardar la conversación' });
  }
});

/**
 * Listar conversaciones (público — solo metadatos, sin contenido, solo últimos 10 min)
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    await db.cleanupOldConversationsMinutes(10);
    const conversations = await db.listRecentConversations(10, 1, limit);

    const convs = Array.isArray(conversations) ? conversations : (conversations.conversations || []);
    const sanitized = convs.map(conv => ({
      sessionId: conv.sessionId,
      avatarId: conv.avatarId,
      messageCount: conv.messages ? conv.messages.length : (conv.messageCount || 0),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));

    res.json({ success: true, count: sanitized.length, conversations: sanitized });
  } catch (error) {
    console.error('Error al listar conversaciones:', error);
    res.status(500).json({ error: 'Error interno al listar conversaciones' });
  }
});

/**
 * Estadísticas de la base de datos (público — solo números agregados)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getDatabaseStats();
    res.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al obtener estadísticas' });
  }
});

/**
 * Conversaciones con paginación y contenido completo (solo admin)
 */
router.get('/paginated', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
    if (page < 1) return res.status(400).json({ error: 'page debe ser >= 1' });

    const result = await db.listConversationsPaginated(page, pageSize);
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al obtener conversaciones paginadas' });
  }
});

/**
 * Obtener conversación por sessionId (público)
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await db.getConversation(sessionId);
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada', sessionId });
    res.json({ success: true, conversation });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al obtener la conversación' });
  }
});

/**
 * Eliminar conversación (solo admin)
 */
router.delete('/:sessionId', requireAdmin, async (req, res) => {
  try {
    const result = await db.deleteConversation(req.params.sessionId);
    res.json({ success: true, ...result, sessionId: req.params.sessionId });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al eliminar la conversación' });
  }
});

/**
 * Limpiar conversaciones antiguas (solo admin)
 */
router.post('/cleanup', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.body.days) || 30;
    if (days < 1 || days > 365) return res.status(400).json({ error: 'days debe estar entre 1 y 365' });
    const result = await db.cleanupOldConversations(days);
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al limpiar conversaciones antiguas' });
  }
});

/**
 * Backup de la base de datos (solo admin)
 */
router.post('/backup', requireAdmin, async (req, res) => {
  try {
    const result = await db.backupDatabase(req.body.backupPath || null);
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al realizar backup' });
  }
});

module.exports = router;
