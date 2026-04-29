/**
 * Rutas para gestionar memoria principal y secundaria
 * 
 * GET  /main        → admin supremo (contiene estructura interna del sistema)
 * GET  /projects    → admin supremo
 * GET  /proyecto-actual → público (solo datos del negocio, no creador)
 * POST /save/main   → admin supremo
 * POST /save/projects → admin supremo
 * POST /recargar    → admin supremo
 */

const express = require('express');
const router = express.Router();
const memoryService = require('../services/memoryService');
const { requireAuth, requireAdmin } = require('../middleware/roles');

/**
 * Buscar proyectos en memoria secundaria (público — para el chat)
 */
router.get('/proyectos/buscar', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'El parámetro "q" debe tener al menos 2 caracteres' });
    }
    const resultados = memoryService.buscarProyecto(q);
    res.json({ success: true, query: q, count: resultados.length, proyectos: resultados });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al buscar proyectos' });
  }
});

/**
 * Obtener solo los datos públicos del proyecto/negocio (público — para el frontend)
 */
router.get('/proyecto-actual', (req, res) => {
  try {
    const proyecto = memoryService.getProyectoActual();
    const { nombre, url, descripcion, objetivo } = proyecto;
    res.json({ success: true, proyecto: { nombre, url, descripcion, objetivo } });
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * Obtener memoria principal completa (solo admin — contiene datos sensibles del sistema)
 */
router.get('/main', requireAdmin, (req, res) => {
  try {
    const memoria = memoryService.getMemoriaPrincipal();
    res.json({ success: true, memoria });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al obtener memoria principal' });
  }
});

/**
 * Obtener memoria de proyectos completa (solo admin)
 */
router.get('/projects', requireAdmin, (req, res) => {
  try {
    const memoria = memoryService.getMemoriaProyectos();
    res.json({ success: true, memoria });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al obtener memoria de proyectos' });
  }
});

/**
 * Recargar memorias desde disco (solo admin)
 */
router.post('/recargar', requireAdmin, (req, res) => {
  try {
    const resultado = memoryService.recargarMemorias();
    res.json({ success: true, message: 'Memorias recargadas correctamente', ...resultado });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al recargar memorias', details: error.message });
  }
});

/**
 * Guardar memoria principal (solo admin)
 */
router.post('/save/main', requireAdmin, async (req, res) => {
  try {
    const { memoria } = req.body;
    if (!memoria) {
      return res.status(400).json({ success: false, error: 'Se requiere el campo "memoria"' });
    }
    const resultado = await memoryService.guardarMemoriaPrincipal(memoria);
    res.json({ success: true, message: 'Memoria principal guardada correctamente', ...resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error interno al guardar memoria principal' });
  }
});

/**
 * Guardar memoria de proyectos (solo admin)
 */
router.post('/save/projects', requireAdmin, async (req, res) => {
  try {
    const { memoria } = req.body;
    if (!memoria) {
      return res.status(400).json({ success: false, error: 'Se requiere el campo "memoria"' });
    }
    if (!Array.isArray(memoria.proyectos)) {
      return res.status(400).json({ success: false, error: 'La memoria debe contener un array "proyectos"' });
    }
    const resultado = await memoryService.guardarMemoriaProyectos(memoria);
    res.json({ success: true, message: 'Memoria de proyectos guardada correctamente', ...resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error interno al guardar memoria de proyectos' });
  }
});

module.exports = router;
