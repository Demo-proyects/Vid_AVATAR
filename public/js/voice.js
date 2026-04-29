/* voice.js v2.3 — Expone _voiceToggleExternal + TTS retry limit */
let isVoiceEnabled=true;
let _audioQueue=[];
let _isPlaying=false;
let _currentAudio=null;
let _ttsFailureCount=0;
let _ttsCooldownUntil=0;
const _TTS_MAX_RETRIES=5;
const _TTS_COOLDOWN_MS=60000;

window.enableAudioOnInteraction=async function(){
  try{const ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();}catch(e){}
};

function _stripEmojis(text){
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,'').replace(/[🎙🤖🎤💫✨🎭🔊💾❌✅]/g,'').replace(/\s+/g,' ').trim();
}

function initVoice(){
  ['voice-toggle-btn-cripta','voice-toggle-btn-kiosk'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click',_toggleVoice);
  });
  _updateVoiceUI();
}

function _toggleVoice(){
  isVoiceEnabled=!isVoiceEnabled;
  if(!isVoiceEnabled)_stopAll();
  _updateVoiceUI();
}

// Expuesto para el botón en el panel de voz del sidebar
window._voiceToggleExternal=function(){
  _toggleVoice();
};

function _updateVoiceUI(){
  const on=document.getElementById('voice-icon-on');
  const off=document.getElementById('voice-icon-off');
  if(on)on.classList.toggle('hidden',!isVoiceEnabled);
  if(off)off.classList.toggle('hidden',isVoiceEnabled);
  ['voice-toggle-btn-cripta','voice-toggle-btn-kiosk'].forEach(id=>{
    const b=document.getElementById(id);if(b)b.classList.toggle('muted',!isVoiceEnabled);
  });
  // Actualizar texto y clase del botón mute en el panel
  const muteBtn=document.getElementById('voice-mute-btn');
  if(muteBtn){
    muteBtn.textContent=isVoiceEnabled?'🔇 Silenciar':'🔊 Activar voz';
    muteBtn.classList.toggle('muted',!isVoiceEnabled);
  }
  const panelBtn=document.getElementById('voice-panel-btn');
  if(panelBtn)panelBtn.classList.toggle('on',isVoiceEnabled);
}

function speakText(text){
  if(!text||!text.trim()||!isVoiceEnabled)return;
  const clean=_stripEmojis(text);if(!clean)return;
  _audioQueue.push({type:'tts',payload:clean});_processQueue();
}

function playPreGeneratedAudio(url){
  _audioQueue.unshift({type:'prebuilt',payload:url});_processQueue();
}

function stopVoice(){_stopAll();}

async function _processQueue(){
  if(_isPlaying||_audioQueue.length===0)return;
  _isPlaying=true;const item=_audioQueue.shift();
  try{
    if(item.type==='prebuilt'){await _playAudioUrl(item.payload,false);}
    else{
      const voiceId=getActiveVoiceId();
      if(!voiceId){_isPlaying=false;_processQueue();return;}
      const url=await _fetchTTS(item.payload,voiceId);
      if(url)await _playAudioUrl(url,true);else{_isPlaying=false;_processQueue();}
    }
  }catch(err){console.error('[voice]',err);_isPlaying=false;if(typeof setAvatarState==='function')setAvatarState(AVATAR_STATES.WAITING);_processQueue();}
}

async function _fetchTTS(text,voiceId){
  // Evitar spam de errores: si ya fallamos mucho, esperar cooldown
  if(_ttsFailureCount>=_TTS_MAX_RETRIES&&Date.now()<_ttsCooldownUntil){
    console.warn(`[voice] TTS en cooldown (${Math.ceil((_ttsCooldownUntil-Date.now())/1000)}s restantes)`);return null;
  }
  // Si pasó el cooldown, resetear contador
  if(Date.now()>=_ttsCooldownUntil&&_ttsFailureCount>=_TTS_MAX_RETRIES)_ttsFailureCount=0;
  try{
    const res=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:voiceId})});
    if(!res.ok)throw new Error(`TTS HTTP ${res.status}`);
    // Éxito — resetear contador de fallos
    _ttsFailureCount=0;
    return URL.createObjectURL(await res.blob());
  }catch(err){
    _ttsFailureCount++;
    if(_ttsFailureCount>=_TTS_MAX_RETRIES)_ttsCooldownUntil=Date.now()+_TTS_COOLDOWN_MS;
    console.error(`[voice] TTS: ${err.message} (fallo ${_ttsFailureCount}/${_TTS_MAX_RETRIES})`);
    return null;
  }
}

function _playAudioUrl(url,isObjectUrl){
  return new Promise(resolve=>{
    const audio=new Audio(url);_currentAudio=audio;
    audio.addEventListener('play',()=>{if(typeof setAvatarState==='function')setAvatarState(AVATAR_STATES.SPEAKING);});
    const done=()=>{if(isObjectUrl)URL.revokeObjectURL(url);_currentAudio=null;_isPlaying=false;if(typeof setAvatarState==='function')setAvatarState(AVATAR_STATES.WAITING);resolve();_processQueue();};
    audio.addEventListener('ended',done);
    audio.addEventListener('error',done);
    audio.play().catch(err=>{console.warn('[voice] Autoplay bloqueado:',err);_currentAudio=null;_isPlaying=false;resolve();_processQueue();});
  });
}

function _stopAll(){
  _audioQueue=[];
  if(_currentAudio){_currentAudio.pause();_currentAudio.src='';_currentAudio=null;}
  _isPlaying=false;
  if(typeof setAvatarState==='function')setAvatarState(AVATAR_STATES.WAITING);
}

window.speakText=speakText;
window.playPreGeneratedAudio=playPreGeneratedAudio;
window.stopVoice=stopVoice;
window.initVoice=initVoice;