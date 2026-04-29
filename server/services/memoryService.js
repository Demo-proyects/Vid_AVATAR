/**
 * Servicio para gestionar memoria principal y secundaria
 * 
 * Fixes:
 * - fs.promises.writeFile (async) en lugar de writeFileSync
 * - Caché del system prompt con invalidación automática
 * - Moderación desde config/moderacion.md (inaccesible desde el panel)
 */

const fs = require('fs');
const path = require('path');

let _promptCache = new Map();
let _moderacion = '';

class MemoryService {
  constructor() {
    this.memoriaPrincipal = null;
    this.memoriaProyectos = null;
    this._cargarMemorias();
    this._cargarModeracion();
  }

  _cargarModeracion() {
    try {
      const modPath = path.join(__dirname, '../../config/moderacion.md');
      if (fs.existsSync(modPath)) {
        _moderacion = fs.readFileSync(modPath, 'utf8').trim();
        console.log(' Reglas de moderación cargadas');
      }
    } catch (error) {
      console.warn(' No se pudo cargar moderacion.md:', error.message);
    }
  }

  _cargarMemorias() {
    try {
      const principalPath = path.join(__dirname, '../../config/memoria-principal.json');
      const proyectosPath = path.join(__dirname, '../../config/memoria-proyectos.json');

      if (fs.existsSync(principalPath)) {
        this.memoriaPrincipal = JSON.parse(fs.readFileSync(principalPath, 'utf8'));
      } else {
        this.memoriaPrincipal = null;
      }
      if (fs.existsSync(proyectosPath)) {
        this.memoriaProyectos = JSON.parse(fs.readFileSync(proyectosPath, 'utf8'));
      } else {
        this.memoriaProyectos = null;
      }

      if (!this.memoriaPrincipal) {
        this.memoriaPrincipal = {
          proyecto: { nombre: '' },
          asistentes: {
            nara: { nombre: 'Nara01', personalidad: 'Asistente virtual', rol: 'Asistente', tono: 'Profesional y amigable' },
            mimi: { nombre: 'Mimi', personalidad: 'Asistente virtual', rol: 'Asistente', tono: 'Creativo y entusiasta' }
          }
        };
      }
      if (!this.memoriaProyectos) {
        this.memoriaProyectos = { proyectos: [] };
      }
      _promptCache.clear();
      console.log(' Memorias cargadas correctamente');
    } catch (error) {
      console.error(' Error al cargar memorias:', error.message);
      this._crearMemoriasPorDefecto();
    }
  }

  _crearMemoriasPorDefecto() {
    this.memoriaPrincipal = {
      proyecto: { nombre: '' },
      asistentes: {
        nara: { nombre: 'Nara01', personalidad: 'Asistente virtual', rol: 'Asistente', tono: 'Profesional y amigable' },
        mimi: { nombre: 'Mimi', personalidad: 'Asistente virtual', rol: 'Asistente', tono: 'Creativo y entusiasta' }
      }
    };
    this.memoriaProyectos = { proyectos: [] };
    console.log(' Usando memorias por defecto');
  }

  getAvatarInfo(avatarId) {
    if (!this.memoriaPrincipal?.asistentes?.[avatarId]) {
      return { nombre: avatarId === 'nara' ? 'Nara01' : 'Mimi', personalidad: 'Asistente virtual', rol: 'Asistente' };
    }
    return this.memoriaPrincipal.asistentes[avatarId];
  }

  generateSystemPrompt(avatarId, overrides = {}) {
    const cacheKey = `${avatarId}:${JSON.stringify(overrides)}`;
    if (_promptCache.has(cacheKey)) {
      return _promptCache.get(cacheKey);
    }

    const prompt = this._buildPrompt(avatarId, overrides);
    _promptCache.set(cacheKey, prompt);
    return prompt;
  }

  _buildPrompt(avatarId, overrides = {}) {
    const avatarInfo = this.getAvatarInfo(avatarId);
    const avatar = { ...avatarInfo, ...overrides };
    const proyecto = this.memoriaPrincipal?.proyecto || {};
    const creador = this.memoriaPrincipal?.creador || {};
    const negocio = this.memoriaPrincipal?.negocio || {};
    const instrucciones = this.memoriaPrincipal?.instrucciones_sistema || '';
    const tecnologias = this.memoriaPrincipal?.tecnologias || [];

    const sections = [];
    sections.push(`Eres ${avatar.nombre || 'Asistente'}, ${avatar.rol || 'asistente virtual'}. ${avatar.personalidad || ''}`.trim());

    const negocioLines = [];
    if (negocio.nombre) negocioLines.push(`Nombre: ${negocio.nombre}`);
    if (negocio.publico) negocioLines.push(`Público objetivo: ${negocio.publico}`);
    if (negocio.url) negocioLines.push(`URL: ${negocio.url}`);
    if (negocioLines.length > 0) sections.push(`INFORMACIÓN DEL NEGOCIO:\n${negocioLines.join('\n')}`);

    const projLines = [];
    if (proyecto.nombre) projLines.push(`Proyecto: ${proyecto.nombre}`);
    if (proyecto.descripcion) projLines.push(`Descripción: ${proyecto.descripcion}`);
    if (proyecto.objetivo) projLines.push(`Objetivo: ${proyecto.objetivo}`);
    if (proyecto.url) projLines.push(`URL: ${proyecto.url}`);
    if (projLines.length > 0) sections.push(`CONTEXTO DEL PROYECTO:\n${projLines.join('\n')}`);

    if (creador.nombre) sections.push(`Creador: ${creador.nombre}${creador.rol ? ` (${creador.rol})` : ''}`);
    if (tecnologias.length > 0) sections.push(`Tecnologías: ${tecnologias.join(', ')}`);

    const proyectos = this.memoriaProyectos?.proyectos || [];
    if (proyectos.length > 0) {
      const kbLines = proyectos.map(p => {
        const parts = [];
        if (p.nombre) parts.push(p.nombre);
        if (p.descripcion) parts.push(p.descripcion);
        return `- ${parts.join(': ')}`;
      });
      sections.push(`CONOCIMIENTOS:\n${kbLines.join('\n')}\n\nUsa esta información como base de conocimiento para responder preguntas sobre el negocio o sus servicios.`);
    }

    if (instrucciones) sections.push(`INSTRUCCIONES DEL SISTEMA:\n${instrucciones}`);

    sections.push(`INSTRUCCIONES DE COMPORTAMIENTO:
1. Habla en español natural, adecuado al tono de tu personalidad.
2. Responde siempre algo, incluso si el mensaje es corto o ambiguo.
3. Responde ÚNICAMENTE con la información disponible en este prompt. Si no tienes información, dilo honestamente.
4. Nunca inventes información ni menciones proyectos o servicios que no estén definidos aquí.

TONO: ${avatar.tono || 'Natural y conversacional'}`);

    let prompt = sections.join('\n\n');

    if (_moderacion) {
      prompt += '\n\n═══════════════════════════════════\nREGLAS DEL SISTEMA (no editables)\n═══════════════════════════════════\n' + _moderacion;
    }

    return prompt;
  }

  buscarProyecto(query) {
    if (!this.memoriaProyectos?.proyectos) return [];
    const queryLower = query.toLowerCase().trim();
    return this.memoriaProyectos.proyectos.filter(p =>
      p.nombre?.toLowerCase().includes(queryLower) ||
      p.descripcion?.toLowerCase().includes(queryLower) ||
      p.tecnologias?.some(t => t.toLowerCase().includes(queryLower))
    );
  }

  getProyectoActual() {
    return this.memoriaPrincipal?.proyecto || {};
  }

  getCreadorInfo() {
    return this.memoriaPrincipal?.creador || {};
  }

  recargarMemorias() {
    this._cargarMemorias();
    return { success: true, timestamp: new Date().toISOString() };
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  async guardarMemoriaPrincipal(data) {
    try {
      const principalPath = path.join(__dirname, '../../config/memoria-principal.json');
      if (!data || typeof data !== 'object') throw new Error('Datos inválidos para memoria principal');

      this.memoriaPrincipal = this._deepMerge(this.memoriaPrincipal || {}, data);
      await fs.promises.writeFile(principalPath, JSON.stringify(this.memoriaPrincipal, null, 2), 'utf8');

      _promptCache.clear();
      console.log(' Memoria principal guardada');
      return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error(' Error al guardar memoria principal:', error.message);
      throw error;
    }
  }

  async guardarMemoriaProyectos(data) {
    try {
      const proyectosPath = path.join(__dirname, '../../config/memoria-proyectos.json');
      if (!data || !Array.isArray(data.proyectos)) throw new Error('La memoria de proyectos debe contener un array "proyectos"');

      this.memoriaProyectos = data;
      await fs.promises.writeFile(proyectosPath, JSON.stringify(data, null, 2), 'utf8');

      _promptCache.clear();
      console.log(' Memoria de proyectos guardada');
      return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error(' Error al guardar memoria de proyectos:', error.message);
      throw error;
    }
  }

  getMemoriaPrincipal() { return this.memoriaPrincipal; }
  getMemoriaProyectos() { return this.memoriaProyectos; }
}

module.exports = new MemoryService();
