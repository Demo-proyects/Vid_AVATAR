/* storage.js — Persistencia con localStorage y SQLite
   Maneja sessionId y sincronización de conversaciones */

const STORAGE_KEYS = {
  MESSAGES: 'vid_messages',
  AVATAR: 'vid_avatar',
  VOICE: 'vid_voice',
  TIMESTAMP: 'vid_timestamp',
  SESSION_ID: 'vid_session_id'
};

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Genera un sessionId único o recupera el existente
 */
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  
  if (!sessionId || sessionId.length < 10) {
    // Generar nuevo sessionId usando crypto.randomUUID si está disponible
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      sessionId = crypto.randomUUID();
    } else {
      // Fallback para navegadores más antiguos
      sessionId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    }
    
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    console.log('💾 Nuevo sessionId generado:', sessionId);
  }
  
  return sessionId;
}

/**
 * Guarda mensajes localmente y en el servidor (SQLite)
 */
async function saveMessages(messages, avatarId) {
  try {
    // Guardar en localStorage
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    localStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
    
    // Guardar en servidor (SQLite)
    const sessionId = getOrCreateSessionId();
    
    const response = await fetch('/api/conversations/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        avatarId: avatarId || window.currentAvatarId || 'nara',
        messages
      })
    });
    
    if (!response.ok) {
      console.warn('⚠️ No se pudo guardar en servidor, pero se guardó localmente');
    } else {
      console.log('💾 Conversación guardada en servidor');
    }
    
  } catch (error) {
    console.error('Error al guardar mensajes:', error);
    // Continuamos aunque falle el servidor
  }
}

/**
 * Carga mensajes desde el servidor (SQLite) o localStorage
 */
async function loadMessages() {
  try {
    const sessionId = getOrCreateSessionId();
    
    // Intentar cargar desde servidor
    const response = await fetch(`/api/conversations/${sessionId}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.conversation) {
        console.log('💾 Mensajes cargados desde servidor');
        return data.conversation.messages;
      }
    }
    
    // Fallback a localStorage
    const localMessages = _loadLocalMessages();
    console.log('💾 Mensajes cargados desde localStorage');
    return localMessages;
    
  } catch (error) {
    console.warn('Error al cargar desde servidor, usando localStorage:', error);
    return _loadLocalMessages();
  }
}

/**
 * Carga mensajes solo desde localStorage
 */
function _loadLocalMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function initStorage() {
  console.log('💾 Storage: inicializando…');
  _cleanStaleSession();
  
  // Restaurar avatar
  const savedAvatar = localStorage.getItem(STORAGE_KEYS.AVATAR);
  if (savedAvatar && savedAvatar !== 'vid') {
    window.currentAvatarId = savedAvatar;
  }
  
  // Restaurar voz
  const savedVoice = localStorage.getItem(STORAGE_KEYS.VOICE);
  if (savedVoice) window._restoredVoice = savedVoice;
  
  // Obtener sessionId
  window.currentSessionId = getOrCreateSessionId();
  console.log('💾 SessionId activo:', window.currentSessionId);
}

function saveAvatarPreference(avatarId, voiceId) {
  try {
    localStorage.setItem(STORAGE_KEYS.AVATAR, avatarId);
    if (voiceId) localStorage.setItem(STORAGE_KEYS.VOICE, voiceId);
  } catch (_) {}
}

function clearSession() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  console.log('💾 Storage: sesión borrada.');
}

function _cleanStaleSession() {
  try {
    const ts = parseInt(localStorage.getItem(STORAGE_KEYS.TIMESTAMP) || '0', 10);
    if (ts && Date.now() - ts > SESSION_TTL_MS) {
      // Solo borrar mensajes, mantener sessionId
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.TIMESTAMP);
      console.log('💾 Storage: mensajes expirados, limpiando.');
    }
  } catch (_) {}
}

// API pública
window.initStorage = initStorage;
window.saveAvatarPreference = saveAvatarPreference;
window.loadSavedMessages = loadMessages; // Actualizado para usar async
window.clearSession = clearSession;
window.getOrCreateSessionId = getOrCreateSessionId;
window.saveMessages = saveMessages;
