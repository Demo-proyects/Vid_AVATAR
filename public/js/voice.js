/* voice.js v2.3 — Voz simplificada: usa defaultVoice del avatar */
let isVoiceEnabled=true;
let _audioQueue=[];
let _isPlaying=false;
let _currentAudio=null;

window.enableAudioOnInteraction=async function(){
  try{const ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();}catch(e){}
};

function _stripEmojis(text){
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,'').replace(/[🎙🤖🎤💫✨🎭🔊💾❌✅]/g,'').replace(/\s+/g,' ').trim();
}

function initVoice(){
  ['voice-toggle-btn','voice-toggle-btn-cripta','voice-toggle-btn-kiosk'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click',_toggleVoice);
  });
  _updateVoiceUI();
  
  // Habilitar audio en la primera interacción del usuario
  const enableAudio = async () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      console.log('[voice] AudioContext habilitado por interacción del usuario');
    } catch(e) {}
    document.removeEventListener('click', enableAudio);
    document.removeEventListener('keydown', enableAudio);
    document.removeEventListener('touchstart', enableAudio);
  };
  document.addEventListener('click', enableAudio, { once: true });
  document.addEventListener('keydown', enableAudio, { once: true });
  document.addEventListener('touchstart', enableAudio, { once: true });
}

function _toggleVoice(){
  isVoiceEnabled=!isVoiceEnabled;
  if(!isVoiceEnabled)_stopAll();
  _updateVoiceUI();
}

function _updateVoiceUI(){
  const on=document.getElementById('voice-icon-on');
  const off=document.getElementById('voice-icon-off');
  if(on)on.classList.toggle('hidden',!isVoiceEnabled);
  if(off)off.classList.toggle('hidden',isVoiceEnabled);
  ['voice-toggle-btn-cripta','voice-toggle-btn-kiosk'].forEach(id=>{
    const b=document.getElementById(id);if(b)b.classList.toggle('muted',!isVoiceEnabled);
  });
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
  try{
    const res=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice:voiceId})});
    if(!res.ok)throw new Error(`TTS HTTP ${res.status}`);
    return URL.createObjectURL(await res.blob());
  }catch(err){console.error('[voice] TTS:',err);return null;}
}

function _playAudioUrl(url,isObjectUrl){
  return new Promise(resolve=>{
    const audio=new Audio(url);_currentAudio=audio;
    audio.addEventListener('play',()=>{if(typeof setAvatarState==='function')setAvatarState(AVATAR_STATES.SPEAKING);});
    const done=()=>{if(isObjectUrl)URL.revokeObjectURL(url);_currentAudio=null;_isPlaying=false;if(typeof setAvatarState==='function')setAvatarState(AVATAR_STATES.WAITING);resolve();_processQueue();};
    audio.addEventListener('ended',done);
    audio.addEventListener('error',done);
    audio.play().catch(err=>{console.warn('[voice] Error al reproducir audio:',err.message);_currentAudio=null;_isPlaying=false;resolve();_processQueue();});
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