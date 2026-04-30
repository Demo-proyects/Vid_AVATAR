/* main.js v2.2 — Sin Vid */

// ─── SALUDO INICIAL ───────────────────────────────────────────
// Edita este texto para cambiar el mensaje de bienvenida.
// Usa {nombre} como marcador del nombre del avatar activo.
const SALUDO_INICIAL = '¡Hola! Soy {nombre}, tu asistente virtual. Bienvenido a El Misterio de Vid. Puedo ayudarte con lo que necesites. Si quieres conocer a mis compañeros, toca "Cambiar asistente".';
// ──────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded',()=>{
  console.log('✨ El Misterio de Vid — v2.2…');
  initStorage();
  initAvatarSystem();
  initVoice();
  initChat();

  // Restaurar voz guardada en todos los selectores
  if(window._restoredVoice){
    setTimeout(()=>{
      ['voice-selector-kiosk','voice-selector-panel','mobile-voice-selector'].forEach(id=>{
        const el=document.getElementById(id);if(el)el.value=window._restoredVoice;
      });
    },200);
  }

  // Saludo inicial: solo si la sesión NO tiene mensajes previos guardados
  const _hayMensajesPrevios = (typeof loadSavedMessages === 'function')
    ? (loadSavedMessages() || []).length > 0
    : false;

  if (!_hayMensajesPrevios) {
    setTimeout(()=>{
      const avName = (window.AVATARS && window.AVATARS[window.currentAvatarId])
        ? window.AVATARS[window.currentAvatarId].name
        : 'Nara01';
      const textoSaludo = SALUDO_INICIAL.replace('{nombre}', avName);

      // Mostrar en pantalla
      addMessage('assistant', textoSaludo, window.currentAvatarId);

      // Leer en voz alta (speakText ya está inicializado por initVoice())
      if(typeof speakText === 'function') speakText(textoSaludo);
    },400);
  }

  // Parchar selectAvatar para persistir preferencia
  const _orig=window.selectAvatar;
  if(typeof _orig==='function'){
    window.selectAvatar=function(id){
      _orig(id);
      if(typeof saveAvatarPreference==='function')saveAvatarPreference(id,getActiveVoiceId());
    };
  }
});