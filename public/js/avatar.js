/* avatar.js v3.1 — TODOS los avatares CON VOZ */
const AVATAR_STATES={IDLE:'idle',WAITING:'waiting',SPEAKING:'speaking'};
const AVATARS={
  nara:{id:'nara',name:'Nara01',personality:'Directo, amigable y eficiente. Va al grano.',
    voices:[{id:'es-US-Neural2-B',name:'Nara01 · Neural US'},{id:'es-ES-Neural2-F',name:'Profunda · Narrador'},{id:'es-ES-Chirp-HD-D',name:'Masculino natural'},{id:'es-ES-Chirp3-HD-Algieba',name:'Grave · HD'},{id:'es-ES-Chirp3-HD-Pulcherrima',name:'Asistente · Pro'}],
    defaultVoice:'es-US-Neural2-B',
    assets:{static:'assets/avatars/nara-estatico.avif',waiting:'assets/avatars/nara-espera.webp',speaking:'assets/avatars/nara-speak.webp'}},
  mimi:{id:'mimi',name:'Mimi',personality:'Entusiasta, empática y muy expresiva. 💫',
    voices:[{id:'es-ES-Neural2-E',name:'Mimi · Simpática'},{id:'es-ES-Neural2-H',name:'Rápida · Fluida'},{id:'es-ES-Chirp-HD-O',name:'Premium · HD'},{id:'es-ES-Chirp3-HD-Leda',name:'Femenina · HD Premium'}],
    defaultVoice:'es-ES-Chirp3-HD-Leda',
    assets:{static:'assets/avatars/mimi-estatico.avif',waiting:'assets/avatars/mimi-espera.webp',speaking:'assets/avatars/mimi-speak.webp'}},
  ava03:{id:'ava03',name:'Ava03',personality:'Robot amigable con curiosidad infantil. Aprende de cada interacción.',
    voices:[{id:'es-ES-Chirp3-HD-Leda',name:'Ava03 · HD Principal'},{id:'es-ES-Neural2-C',name:'Neutral · Clara'},{id:'es-ES-Chirp-HD-A',name:'Premium · Natural'}],
    defaultVoice:'es-ES-Chirp3-HD-Leda',
    assets:{static:'assets/avatars/ava03-estatico.avif',waiting:'assets/avatars/ava03-estatico.avif',speaking:'assets/avatars/ava03-estatico.avif'}},
  vid:{id:'vid',name:'Vid',personality:'Misteriosa, enigmática, habla en acertijos.',
    voices:[{id:'es-ES-Neural2-F',name:'Vid · Voz Profunda'},{id:'es-ES-Chirp3-HD-Pulcherrima',name:'Susurro · HD'},{id:'es-ES-Chirp-HD-D',name:'Enigma · Grave'}],
    defaultVoice:'es-ES-Neural2-F',
    assets:{static:'assets/avatars/vid-estatico.avif',waiting:'assets/avatars/vid-estatico.avif',speaking:'assets/avatars/vid-estatico.avif'}},
};

window.currentAvatarId='nara';
let _currentAvatarState=AVATAR_STATES.WAITING;

function initAvatarSystem(){_renderActiveAvatar();_renderGallery();_setupAvatarListeners();}

function setAvatarState(state){
  _currentAvatarState=state;
  const av=AVATARS[window.currentAvatarId];if(!av)return;
  let src=av.assets.waiting;
  if(state===AVATAR_STATES.SPEAKING&&av.assets.speaking)src=av.assets.speaking;
  else if(state===AVATAR_STATES.IDLE)src=av.assets.static;
  ['main-avatar-img','mobile-avatar-img','main-avatar-img-kiosk','mobile-avatar-img-kiosk'].forEach(id=>_setSrc(id,src));
  ['avatar-ring','mobile-avatar-ring'].forEach(id=>{const r=document.getElementById(id);if(r)r.classList.toggle('speaking',state===AVATAR_STATES.SPEAKING);});
  const dot=document.getElementById('state-dot');
  if(dot)dot.style.background=state===AVATAR_STATES.SPEAKING?'#06b6d4':'#7c3aed';
  _setText('state-label',state===AVATAR_STATES.SPEAKING?'HABLANDO…':'EN ESPERA');
  _setText('mobile-state-label','● '+(state===AVATAR_STATES.SPEAKING?'HABLANDO':'EN ESPERA'));
  const d2ms=document.querySelector('.d2-mob-av-state');
  if(d2ms)d2ms.textContent=state===AVATAR_STATES.SPEAKING?'ACTIVE':'SYS_OK';
}

function _syncAvatarsToLayouts(){
  const av=AVATARS[window.currentAvatarId];if(!av)return;
  let src=av.assets.waiting;
  if(_currentAvatarState===AVATAR_STATES.SPEAKING&&av.assets.speaking)src=av.assets.speaking;
  else if(_currentAvatarState===AVATAR_STATES.IDLE)src=av.assets.static;
  ['main-avatar-img','mobile-avatar-img','main-avatar-img-kiosk','mobile-avatar-img-kiosk'].forEach(id=>_setSrc(id,src));
  _setText('mobile-avatar-name',av.name);
  document.querySelectorAll('.d2-av-name').forEach(el=>el.textContent=av.name);
  document.querySelectorAll('.d2-mob-av-name').forEach(el=>el.textContent=av.name);
  const p=document.querySelector('.d2-av-persona');
  if(p)p.textContent=av.personality.split('.')[0].substring(0,40);
  _populateVoiceSelector('voice-selector-kiosk',av);
  _populateVoiceSelector('voice-selector-panel',av);
}

function _renderActiveAvatar(){
  const av=AVATARS[window.currentAvatarId];if(!av)return;
  ['main-avatar-img','mobile-avatar-img','main-avatar-img-kiosk','mobile-avatar-img-kiosk'].forEach(id=>_setSrc(id,av.assets.waiting));
  _setText('mobile-avatar-name',av.name);
  document.querySelectorAll('.d2-av-name').forEach(el=>el.textContent=av.name);
  const p=document.querySelector('.d2-av-persona');if(p)p.textContent=av.personality.split('.')[0].substring(0,40);
  _populateVoiceSelector('voice-selector-kiosk',av);
  _populateVoiceSelector('voice-selector-panel',av);
  _populateVoiceSelector('mobile-voice-selector',av);
  _syncAvatarsToLayouts();
  setAvatarState(AVATAR_STATES.WAITING);
}

function _populateVoiceSelector(selectorId,av){
  const sel=document.getElementById(selectorId);if(!sel)return;
  sel.innerHTML='';
  if(!av.voices.length){sel.innerHTML='<option value="">— Sin voz —</option>';sel.disabled=true;return;}
  sel.disabled=false;
  av.voices.forEach(v=>{const opt=document.createElement('option');opt.value=v.id;opt.textContent=v.name;if(v.id===av.defaultVoice)opt.selected=true;sel.appendChild(opt);});
}

function _renderGallery(){
  const g=document.getElementById('avatar-gallery');if(!g)return;g.innerHTML='';
  Object.values(AVATARS).forEach(av=>{
    const card=document.createElement('div');
    card.className=`gallery-card ${av.id===window.currentAvatarId?'active':''}`;
    card.setAttribute('role','button');card.setAttribute('tabindex','0');
    card.innerHTML=`<img src="${av.assets.static}" alt="${av.name}" loading="lazy"/><p>${av.name}</p>`;
    card.addEventListener('click',()=>selectAvatar(av.id));
    card.addEventListener('keydown',e=>{if(e.key==='Enter')selectAvatar(av.id);});
    g.appendChild(card);
  });
}

function selectAvatar(id){
  if(!AVATARS[id])return;
  window.currentAvatarId=id;
  _renderActiveAvatar();_renderGallery();_closeGallery();
  if(typeof saveAvatarPreference==='function')saveAvatarPreference(id,getActiveVoiceId());
}

function _openGallery(){const m=document.getElementById('gallery-modal');if(m)m.classList.remove('hidden');}
function _closeGallery(){const m=document.getElementById('gallery-modal');if(m)m.classList.add('hidden');}

function _setupAvatarListeners(){
  document.getElementById('avatar-ring')?.addEventListener('click',_openGallery);
  document.getElementById('sidebar-avatar-btn')?.addEventListener('click',_openGallery);
  document.getElementById('mobile-avatar-ring')?.addEventListener('click',_openGallery);
  document.getElementById('change-assistant-btn-kiosk')?.addEventListener('click',_openGallery);
  document.getElementById('close-gallery-btn')?.addEventListener('click',_closeGallery);
  document.getElementById('gallery-backdrop')?.addEventListener('click',_closeGallery);
  document.querySelector('.d1-mob-tab-asistente')?.addEventListener('click',_openGallery);
  document.querySelector('.d2-mob-tab-avatar')?.addEventListener('click',_openGallery);
  // Sync selectors bidireccional
  ['voice-selector-panel','voice-selector-kiosk','mobile-voice-selector'].forEach(srcId=>{
    document.getElementById(srcId)?.addEventListener('change',e=>{
      ['voice-selector-panel','voice-selector-kiosk','mobile-voice-selector'].forEach(tId=>{
        if(tId!==srcId){const el=document.getElementById(tId);if(el)el.value=e.target.value;}
      });
    });
  });
}

function getActiveVoiceId(){
  for(const id of['voice-selector-panel','voice-selector-kiosk','mobile-voice-selector']){
    const el=document.getElementById(id);if(el&&el.value)return el.value;
  }
  return AVATARS[window.currentAvatarId]?.defaultVoice||'';
}

function _setSrc(id,src){const el=document.getElementById(id);if(el)el.src=src;}
function _setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}

window.selectAvatar=selectAvatar;
window.getActiveVoiceId=getActiveVoiceId;
window.setAvatarState=setAvatarState;
window.AVATARS=AVATARS;
window.AVATAR_STATES=AVATAR_STATES;
window.syncAvatars=_syncAvatarsToLayouts;
window.initAvatarSystem=initAvatarSystem;
