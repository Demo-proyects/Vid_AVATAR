/* main.js v2.2 — Sin Vid */
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

  // Saludo inicial con el nombre del avatar guardado
  setTimeout(()=>{
    const avName = (window.AVATARS && window.AVATARS[window.currentAvatarId]) ? window.AVATARS[window.currentAvatarId].name : 'Nara01';
    addMessage('assistant','¡Hola! Soy '+avName+', tu asistente virtual. Bienvenido a El Misterio de Vid. Puedo ayudarte con lo que necesites. Si quieres conocer a mis compañeros, toca "Cambiar asistente".',window.currentAvatarId);
  },400);

  // Parchar selectAvatar para persistir preferencia
  const _orig=window.selectAvatar;
  if(typeof _orig==='function'){
    window.selectAvatar=function(id){
      _orig(id);
      if(typeof saveAvatarPreference==='function')saveAvatarPreference(id,getActiveVoiceId());
    };
  }
});