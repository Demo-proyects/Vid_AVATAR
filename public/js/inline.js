/* ════════════════════════════════════════════════════════════
   INLINE SCRIPT — MISTERIO DE VID (v4.0 — CORREGIDO)
   ════════════════════════════════════════════════════════════
   Movido a archivo separado para evitar bloqueos CSP.
   Cada bloque funcional es independiente con try/catch propio.
   Las funciones críticas se definen como window.* para disponibilidad global.
   ════════════════════════════════════════════════════════════ */
console.log('[inline] Script v4.0 cargado y ejecutando');

/* ════════════════════════════════════════════════════════════
   SWITCH (Kiosk/Cripta) — Definiciones globales
   ════════════════════════════════════════════════════════════ */
try {
const d1El = document.getElementById('d1');
const d2El = document.getElementById('d2');
const overlay = document.getElementById('t-overlay');
let current=1, busy=false;

window._switchDirect = function(toD2){
  if(toD2){d1El.style.display='none';d2El.style.display='flex';current=2;}
  else{d2El.style.display='none';d1El.style.display='flex';current=1;}
  document.body.classList.toggle('kiosk-mode', toD2);
  if(typeof window.updateActiveChat==='function')window.updateActiveChat(toD2?'kiosk':'cripta');
  if(typeof window.syncAvatars==='function')window.syncAvatars();
  busy=false;
};

function getOrigin(el){
  const r=el.getBoundingClientRect();
  return{x:((r.left+r.width/2)/window.innerWidth*100).toFixed(2),y:((r.top+r.height/2)/window.innerHeight*100).toFixed(2)};
}

window.doSwitch = function(originEl){
  if(busy)return;busy=true;
  const toD2=current===1;
  if(typeof gsap==='undefined')return window._switchDirect(toD2);
  try{
    const{x,y}=getOrigin(originEl);
    overlay.style.background=toD2?'#040e18':'#080810';
    overlay.style.clipPath=`circle(0% at ${x}% ${y}%)`;
    overlay.style.pointerEvents='all';
    gsap.to(overlay,{duration:.55,ease:'power3.in',clipPath:`circle(160% at ${x}% ${y}%)`,
      onComplete:()=>{
        if(toD2){d1El.style.display='none';d2El.style.display='flex';current=2;document.body.classList.add('kiosk-mode');if(typeof window.updateActiveChat==='function')window.updateActiveChat('kiosk');if(typeof window.syncAvatars==='function')window.syncAvatars();}
        else{d2El.style.display='none';d1El.style.display='flex';current=1;document.body.classList.remove('kiosk-mode');if(typeof window.updateActiveChat==='function')window.updateActiveChat('cripta');if(typeof window.syncAvatars==='function')window.syncAvatars();}
        gsap.to(overlay,{duration:.5,ease:'power3.out',clipPath:`circle(0% at ${x}% ${y}%)`,onComplete:()=>{overlay.style.pointerEvents='none';busy=false;}});
      }
    });
  }catch(e){console.warn('[switch] GSAP falló, usando directo:',e);window._switchDirect(toD2);}
};

/* ── Event listeners del switch ── */
document.getElementById('sw-btn-sidebar')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
document.getElementById('sw-btn-kiosk-panel')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
document.querySelector('.d1-mob-tab-switch')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
document.querySelector('.d2-mob-tab-switch')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
console.log('[inline] Switch listeners registrados');
}catch(e){console.error('[switch] Error:',e);}



/* ════════════════════════════════════════════════════════════
   TABS — CORREGIDO: ya no pisa estados de botones del sidebar
   ════════════════════════════════════════════════════════════ */
try {
document.querySelectorAll('.d1-tab').forEach(t=>t.addEventListener('click',(e)=>{
  e.stopPropagation();
  document.querySelectorAll('.d1-tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
}));
document.querySelectorAll('.d2-tab').forEach(t=>t.addEventListener('click',(e)=>{
  e.stopPropagation();
  document.querySelectorAll('.d2-tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
}));
// NOTA: Se ELIMINA el listener genérico de .d1-ico que pisaba los estados de los botones del sidebar
// Cada botón del sidebar maneja su propio estado visual ahora
console.log('[inline] Tab listeners registrados (sin pisar sidebar)');
}catch(e){console.error('[tabs] Error:',e);}

/* ════════════════════════════════════════════════════════════
   HISTORIAL DE CONVERSACIONES — CORREGIDO con feedback visual inmediato
   ════════════════════════════════════════════════════════════ */
try {
const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const historyCloseBtn = document.getElementById('history-close-btn');
const historyBackdrop = document.getElementById('history-backdrop');

async function openHistory() {
  if (!historyModal) {
    console.error('[history] Modal no encontrado');
    return;
  }
  console.log('[history] Abriendo historial...');
  historyModal.classList.remove('hidden');
  historyList.innerHTML = '<div class="history-loading">Cargando historial...</div>';
  
  try {
    const res = await fetch('/api/conversations?limit=50');
    const data = await res.json();
    
    if (!data.success || !data.conversations || data.conversations.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No hay conversaciones guardadas aún.</div>';
      return;
    }
    
    historyList.innerHTML = '';
    data.conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const date = new Date(conv.createdAt);
      const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const avatarName = conv.avatarId ? ((window.AVATARS||{})[conv.avatarId]?.name || conv.avatarId) : 'Desconocido';
      const preview = conv.messages && conv.messages.length > 0 
        ? conv.messages[0].content.substring(0, 80) + (conv.messages[0].content.length > 80 ? '...' : '')
        : 'Conversación vacía';
      
      item.innerHTML = `
        <div class="history-item-date">${dateStr}</div>
        <div class="history-item-avatar">${avatarName} · ${conv.messages?.length || 0} mensajes</div>
        <div class="history-item-preview">${preview}</div>
      `;
      
      item.addEventListener('click', () => loadConversation(conv.sessionId));
      historyList.appendChild(item);
    });
  } catch (err) {
    console.error('[history] Error al cargar:', err);
    historyList.innerHTML = '<div class="history-empty">Error al cargar el historial. Verifica la consola.</div>';
  }
}

async function loadConversation(sessionId) {
  try {
    const res = await fetch(`/api/conversations/${sessionId}`);
    const data = await res.json();
    
    if (data.success && data.conversation) {
      const conv = data.conversation;
      const messages = conv.messages || [];
      
      clearChatView();
      
      if (typeof window.loadSavedMessages === 'function') {
        localStorage.setItem('vid_messages', JSON.stringify(messages));
        localStorage.setItem('vid_avatar', conv.avatarId || 'nara');
        localStorage.setItem('vid_timestamp', Date.now().toString());
        location.reload();
      }
    }
  } catch (err) {
    console.error('[history] Error al cargar conversación:', err);
  }
  
  if (historyModal) historyModal.classList.add('hidden');
}

function closeHistory() {
  if (historyModal) historyModal.classList.add('hidden');
}

function newChat() {
  localStorage.removeItem('vid_messages');
  localStorage.removeItem('vid_timestamp');
  // Nuevo sessionId → se guarda como conversación separada en el historial
  localStorage.removeItem('vid_session_id');
  if (typeof window.getOrCreateSessionId === 'function') {
    window.currentSessionId = window.getOrCreateSessionId();
  }
  if (typeof window.stopVoice === 'function') window.stopVoice();
  clearChatView();
  // Mensaje system para que el LLM OLVIDE el contexto anterior
  if (window.ChatManager) {
    window.ChatManager.messages = [{ role: 'system', content: 'Has olvidado toda la conversación anterior. Esta es una conversación completamente nueva. No menciones nada de lo hablado antes. Empieza desde cero. No digas que has olvidado, simplemente actúa como si fuera la primera interacción.' }];
  }
  // Limpiar conversación en el servidor
  if (typeof window.saveMessages === 'function') {
    window.saveMessages([], window.currentAvatarId || 'nara');
  }
}

function clearChatView() {
  ['chat-history-cripta', 'chat-history-kiosk'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  
  // ChatManager puede no estar disponible si chat.js no cargó aún
  if (window.ChatManager && typeof window.ChatManager === 'object') {
    try {
      window.ChatManager.messages = [];
      window.ChatManager.currentSentence = '';
      window.ChatManager.isResponding = false;
    } catch(_){}
  }
}

// Event listeners para historial y nuevo chat
document.getElementById('history-btn-sidebar')?.addEventListener('click', function(e) {
  e.stopPropagation();
  console.log('[inline] Click en history-btn-sidebar');
  openHistory();
});
historyCloseBtn?.addEventListener('click', function(e) {
  e.stopPropagation();
  closeHistory();
});
historyBackdrop?.addEventListener('click', function(e) {
  e.stopPropagation();
  closeHistory();
});
document.getElementById('new-chat-btn-sidebar')?.addEventListener('click', function(e) {
  e.stopPropagation();
  console.log('[inline] Click en new-chat-btn-sidebar');
  newChat();
});
// Mobile tabs para historial y nuevo chat
document.querySelector('.d1-mob-tab-history')?.addEventListener('click', function(e) {
  e.stopPropagation();
  console.log('[inline] Click en d1-mob-tab-history');
  openHistory();
});
document.querySelector('.d1-mob-tab-newchat')?.addEventListener('click', function(e) {
  e.stopPropagation();
  console.log('[inline] Click en d1-mob-tab-newchat');
  newChat();
});
document.querySelector('.d2-mob-tab-history')?.addEventListener('click', function(e) {
  e.stopPropagation();
  console.log('[inline] Click en d2-mob-tab-history');
  openHistory();
});
document.querySelector('.d2-mob-tab-newchat')?.addEventListener('click', function(e) {
  e.stopPropagation();
  console.log('[inline] Click en d2-mob-tab-newchat');
  newChat();
});
console.log('[inline] History/NewChat listeners registrados');
}catch(e){console.error('[history] Error:',e);}

/* ════════════════════════════════════════════════════════════
   FEEDBACK VISUAL INMEDIATO para botones del sidebar
   ════════════════════════════════════════════════════════════ */
try {
// Todos los .d1-ico reciben feedback visual inmediato al hacer clic
document.querySelectorAll('.d1-ico').forEach(btn => {
  btn.addEventListener('click', function(e) {
    // Feedback visual inmediato: flash momentáneo
    const originalBg = this.style.background;
    this.style.background = 'rgba(124,58,237,0.3)';
    setTimeout(() => {
      this.style.background = originalBg || '';
    }, 150);
  });
});
console.log('[inline] Feedback visual inmediato registrado en botones');
}catch(e){console.error('[feedback] Error:',e);}

/* ════════════════════════════════════════════════════════════
   CHAT INPUT — Auto-resize + Character Counter
   ════════════════════════════════════════════════════════════ */
try {
function autoResize(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,parseInt(el.style.maxHeight||140))+'px';
}
function setupChatInput(inputId){
  var input=document.getElementById(inputId);
  if(!input)return;
  input.addEventListener('input',function(){
    var len=this.value.length,max=parseInt(this.getAttribute('maxlength')||400),pct=len/max;
    this.classList.toggle('char-warn',pct>=0.85);
    this.classList.toggle('char-over',pct>=1);
    autoResize(this);
  });
  autoResize(input);
}
setupChatInput('chat-input-cripta');
setupChatInput('chat-input-kiosk');
console.log('[inline] Auto-resize + warning visual en inputs de chat');
}catch(e){console.error('[chinput] Error:',e);}

console.log('[inline] Script v4.0 — TODOS los módulos cargados correctamente');
