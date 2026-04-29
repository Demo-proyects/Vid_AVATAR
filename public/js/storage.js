/* storage.js — Persistencia con localStorage
   FIX: usa window.currentAvatarId en lugar de variable local */

const STORAGE_KEYS = {
  MESSAGES:'vid_messages',
  AVATAR:'vid_avatar',
  VOICE:'vid_voice',
  TIMESTAMP:'vid_timestamp',
};
const SESSION_TTL_MS = 24*60*60*1000;

function initStorage(){
  console.log('💾 Storage: inicializando…');
  _cleanStaleSession();
  // Restaurar avatar — window.currentAvatarId debe existir (definido en avatar.js)
  const savedAvatar = localStorage.getItem(STORAGE_KEYS.AVATAR);
  // AVATARS puede no estar listo aún si storage carga antes que avatar.js,
  // por eso usamos un guard con DOMContentLoaded o simplemente seteamos el string
  if(savedAvatar && savedAvatar !== 'vid'){
    window.currentAvatarId = savedAvatar;
  }
  const savedVoice = localStorage.getItem(STORAGE_KEYS.VOICE);
  if(savedVoice) window._restoredVoice = savedVoice;
}

function saveAvatarPreference(avatarId, voiceId){
  try{
    localStorage.setItem(STORAGE_KEYS.AVATAR, avatarId);
    if(voiceId) localStorage.setItem(STORAGE_KEYS.VOICE, voiceId);
  }catch(_){}
}

function loadSavedMessages(){
  return _loadMessages();
}

function saveMessages(messages, avatarId){
  try{
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    if(avatarId) localStorage.setItem(STORAGE_KEYS.AVATAR, avatarId);
    localStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
  }catch(_){}
}

function clearSession(){
  Object.values(STORAGE_KEYS).forEach(k=>localStorage.removeItem(k));
  console.log('💾 Storage: sesión borrada.');
}

function _loadMessages(){
  try{
    const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    return raw ? JSON.parse(raw) : [];
  }catch(_){return [];}
}

function _cleanStaleSession(){
  try{
    const ts = parseInt(localStorage.getItem(STORAGE_KEYS.TIMESTAMP)||'0',10);
    if(ts && Date.now()-ts > SESSION_TTL_MS){
      clearSession();
      console.log('💾 Storage: sesión expirada, limpiando.');
    }
  }catch(_){}
}

window.initStorage          = initStorage;
window.saveAvatarPreference = saveAvatarPreference;
window.loadSavedMessages    = loadSavedMessages;
window.saveMessages         = saveMessages;
window.clearSession         = clearSession;